import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import prisma from '../../database/index.js';
import { requireRole } from '../../middleware/authorize.js';
import { ApiError } from '../../utils/ApiError.js';
import { sendSuccess } from '../../utils/response.js';
import { asyncHandler, pagination, pageResult } from '../shared/handlers.js';

const router = Router();
const id = z.string().min(1);
const date = z.coerce.date();
const createInput = z.object({
  customerId: id,
  paymentTerms: z.string().trim().max(1000).optional(),
  startDate: date.optional(),
  endDate: date.optional(),
  autoRenew: z.boolean().default(true),
  items: z.array(z.object({ planId: id, variantId: id.optional(), quantity: z.number().int().positive() })).min(1),
});
const subscriptionInclude = { customer: true, items: { include: { product: { select: { id: true, name: true, type: true, description: true } }, plan: true, variant: true } } };

const transitions = {
  draft: ['quotation'],
  quotation: ['confirmed'],
  confirmed: ['active'],
  active: ['paused', 'closed'],
  paused: ['active', 'closed'],
  closed: [],
};

router.get('/subscriptions', requireRole('admin', 'staff', 'customer'), asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = pagination(req.query);
  const status = req.query.status ? String(req.query.status).toLowerCase() : undefined;
  const where = {
    ...(status ? { status: status.toLowerCase() } : {}),
    ...(req.user.role.toLowerCase() === 'customer' ? { customer: { userId: req.user.id } } : {}),
  };
  const [data, total] = await prisma.$transaction([
    prisma.subscription.findMany({ where, include: subscriptionInclude, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.subscription.count({ where }),
  ]);
  return sendSuccess(res, pageResult(data, total, page, pageSize));
}));

router.post('/subscriptions', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const input = createInput.parse(req.body);
  if (input.endDate && input.startDate && input.endDate < input.startDate) throw ApiError.badRequest('endDate must be on or after startDate.');

  const customer = await prisma.customer.findUnique({ where: { id: input.customerId }, select: { id: true } });
  if (!customer) throw ApiError.notFound('Customer not found.');

  const requestedPlanIds = [...new Set(input.items.map((item) => item.planId))];
  const plans = await prisma.subscriptionPlan.findMany({
    where: { id: { in: requestedPlanIds }, status: 'active' },
    include: { product: true },
  });
  if (plans.length !== requestedPlanIds.length) throw ApiError.badRequest('One or more plans are missing or inactive.');

  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const cadenceKey = (plan) => `${plan.billingInterval}:${plan.intervalCount}`;
  if (new Set(plans.map(cadenceKey)).size !== 1) {
    throw ApiError.badRequest('All items in one subscription must share a billing interval and interval count.');
  }

  for (const item of input.items) {
    const plan = planById.get(item.planId);
    if (item.quantity < plan.minimumQuantity) throw ApiError.badRequest(`Plan ${plan.name} requires a minimum quantity of ${plan.minimumQuantity}.`);
    if (input.startDate && plan.availableFrom && input.startDate < plan.availableFrom) throw ApiError.badRequest(`Plan ${plan.name} is not available yet.`);
    if (input.startDate && plan.availableUntil && input.startDate > plan.availableUntil) throw ApiError.badRequest(`Plan ${plan.name} is no longer available.`);
  }

  const cadence = plans[0];
  for (const item of input.items) {
    if (!item.variantId) continue;
    const variant = await prisma.productVariant.findFirst({ where: { id: item.variantId, productId: planById.get(item.planId).productId }, select: { id: true } });
    if (!variant) throw ApiError.badRequest('Each variant must belong to the product on its subscription plan.');
  }
  const subscription = await prisma.subscription.create({
    data: {
      number: `SUB-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
      customerId: input.customerId,
      paymentTerms: input.paymentTerms,
      startDate: input.startDate,
      endDate: input.endDate,
      autoRenew: input.autoRenew,
      autoClose: plans.some((plan) => plan.autoClose),
      billingInterval: cadence.billingInterval,
      intervalCount: cadence.intervalCount,
      status: 'draft',
      items: { create: input.items.map((item) => {
        const plan = planById.get(item.planId);
        return {
          productId: plan.productId,
          planId: plan.id,
          variantId: item.variantId,
          description: `${plan.product.name} - ${plan.name}`,
          quantity: item.quantity,
          unitPricePaise: plan.amountPaise,
          startDate: input.startDate,
          endDate: input.endDate,
        };
      }) },
    },
    include: { ...subscriptionInclude, invoices: { orderBy: { billingPeriodStart: 'desc' }, take: 12 } },
  });
  return sendSuccess(res, subscription, 'Subscription created in draft.', 201);
}));

router.get('/subscriptions/:id', requireRole('admin', 'staff', 'customer'), asyncHandler(async (req, res) => {
  const subscriptionId = id.parse(req.params.id);
  const subscription = await prisma.subscription.findFirst({
    where: {
      id: subscriptionId,
      ...(req.user.role.toLowerCase() === 'customer' ? { customer: { userId: req.user.id } } : {}),
    },
    include: { ...subscriptionInclude, invoices: { orderBy: { billingPeriodStart: 'desc' }, take: 12 } },
  });
  if (!subscription) throw ApiError.notFound('Subscription not found.');
  return sendSuccess(res, subscription);
}));

router.patch('/subscriptions/:id', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const subscriptionId = id.parse(req.params.id);
  const input = z.object({
    paymentTerms: z.string().trim().max(1000).nullable().optional(),
    startDate: date.nullable().optional(),
    endDate: date.nullable().optional(),
    autoRenew: z.boolean().optional(),
  }).refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update.').parse(req.body);

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.subscription.findUnique({ where: { id: subscriptionId } });
    if (!current) throw ApiError.notFound('Subscription not found.');
    if (!['draft', 'quotation'].includes(current.status)) throw ApiError.conflict('Only draft or quotation subscriptions can be edited.');
    const result = await tx.subscription.update({ where: { id: subscriptionId }, data: input, include: { customer: true, items: true } });
    await tx.auditLog.create({ data: { actorUserId: req.user.id, action: 'subscription.updated', entityType: 'subscription', entityId: subscriptionId, before: { status: current.status }, after: { fields: Object.keys(input) } } });
    return result;
  });
  return sendSuccess(res, updated, 'Subscription updated.');
}));

router.patch('/subscriptions/:id/items', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const subscriptionId = id.parse(req.params.id);
  const input = z.object({ items: z.array(z.object({ planId: id, variantId: id.optional(), quantity: z.number().int().positive() })).min(1) }).parse(req.body);
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.subscription.findUnique({ where: { id: subscriptionId } });
    if (!current) throw ApiError.notFound('Subscription not found.');
    if (!['draft', 'quotation'].includes(current.status)) throw ApiError.conflict('Subscription items can be edited only while the subscription is a draft or quotation.');
    const planIds = [...new Set(input.items.map((item) => item.planId))];
    const plans = await tx.subscriptionPlan.findMany({ where: { id: { in: planIds }, status: 'active' }, include: { product: true } });
    if (plans.length !== planIds.length) throw ApiError.badRequest('One or more plans are missing or inactive.');
    if (new Set(plans.map((plan) => `${plan.billingInterval}:${plan.intervalCount}`)).size !== 1) throw ApiError.badRequest('All items in one subscription must share a billing cadence.');
    const planById = new Map(plans.map((plan) => [plan.id, plan]));
    for (const item of input.items) {
      const plan = planById.get(item.planId);
      if (item.quantity < plan.minimumQuantity) throw ApiError.badRequest(`Plan ${plan.name} requires a minimum quantity of ${plan.minimumQuantity}.`);
      if (current.startDate && plan.availableFrom && current.startDate < plan.availableFrom) throw ApiError.badRequest(`Plan ${plan.name} is not available yet.`);
      if (current.startDate && plan.availableUntil && current.startDate > plan.availableUntil) throw ApiError.badRequest(`Plan ${plan.name} is no longer available.`);
      if (item.variantId) {
        const variant = await tx.productVariant.findFirst({ where: { id: item.variantId, productId: plan.productId }, select: { id: true } });
        if (!variant) throw ApiError.badRequest('Each variant must belong to the product on its subscription plan.');
      }
    }
    await tx.subscriptionItem.deleteMany({ where: { subscriptionId } });
    await tx.subscriptionItem.createMany({ data: input.items.map((item) => {
      const plan = planById.get(item.planId);
      return { subscriptionId, productId: plan.productId, planId: plan.id, variantId: item.variantId, description: `${plan.product.name} - ${plan.name}`, quantity: item.quantity, unitPricePaise: plan.amountPaise, startDate: current.startDate, endDate: current.endDate };
    }) });
    await tx.subscription.update({ where: { id: subscriptionId }, data: { billingInterval: plans[0].billingInterval, intervalCount: plans[0].intervalCount, autoClose: plans.some((plan) => plan.autoClose) } });
    await tx.auditLog.create({ data: { actorUserId: req.user.id, action: 'subscription.items_updated', entityType: 'subscription', entityId: subscriptionId, after: { itemCount: input.items.length } } });
    return tx.subscription.findUnique({ where: { id: subscriptionId }, include: subscriptionInclude });
  });
  return sendSuccess(res, updated, 'Subscription items updated.');
}));

router.post('/subscriptions/:id/transition', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const subscriptionId = id.parse(req.params.id);
  const input = z.object({ to: z.enum(['quotation', 'confirmed', 'active', 'paused', 'closed']), reason: z.string().trim().max(1000).optional() }).parse(req.body);
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.subscription.findUnique({ where: { id: subscriptionId } });
    if (!current) throw ApiError.notFound('Subscription not found.');
    const from = current.status.toLowerCase();
    if (!transitions[from]?.includes(input.to)) throw ApiError.conflict(`Cannot transition a ${from} subscription to ${input.to}.`);

    const now = new Date();
    const data = { status: input.to };
    if (input.to === 'active') {
      const startDate = current.startDate || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      data.startDate = startDate;
      data.nextBillingDate = startDate;
      data.pausedAt = null;
    } else if (input.to === 'paused') {
      data.pausedAt = now;
    } else if (input.to === 'closed') {
      data.closedAt = now;
      data.closeReason = input.reason || null;
      data.nextBillingDate = null;
    }

    const changed = await tx.subscription.updateMany({ where: { id: subscriptionId, status: current.status }, data });
    if (changed.count !== 1) throw ApiError.conflict('Subscription changed concurrently; reload and retry.');
    await tx.auditLog.create({ data: { actorUserId: req.user.id, action: 'subscription.status_changed', entityType: 'subscription', entityId: subscriptionId, before: { status: current.status }, after: { status: input.to, reason: input.reason || null } } });
    return tx.subscription.findUnique({ where: { id: subscriptionId }, include: { customer: true, items: true } });
  });
  return sendSuccess(res, updated, `Subscription moved to ${input.to}.`);
}));

router.post('/subscriptions/:id/renew', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const subscriptionId = id.parse(req.params.id);
  const input = z.object({ startDate: date.optional(), endDate: date.optional(), autoRenew: z.boolean().optional() }).parse(req.body);
  if (input.endDate && input.startDate && input.endDate < input.startDate) throw ApiError.badRequest('endDate must be on or after startDate.');

  const renewed = await prisma.$transaction(async (tx) => {
    const previous = await tx.subscription.findUnique({ where: { id: subscriptionId }, include: { items: true, renewal: true } });
    if (!previous) throw ApiError.notFound('Subscription not found.');
    if (previous.status !== 'closed') throw ApiError.conflict('Only a closed subscription can be renewed.');
    if (previous.renewal) throw ApiError.conflict('This subscription already has a renewal.');
    const now = new Date();
    const startDate = input.startDate || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    if (input.endDate && input.endDate < startDate) throw ApiError.badRequest('endDate must be on or after startDate.');
    const result = await tx.subscription.create({
      data: {
        number: `SUB-${now.getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        customerId: previous.customerId,
        renewedFromId: previous.id,
        status: 'confirmed',
        billingInterval: previous.billingInterval,
        intervalCount: previous.intervalCount,
        currency: previous.currency,
        paymentTerms: previous.paymentTerms,
        startDate,
        endDate: input.endDate,
        autoRenew: input.autoRenew ?? previous.autoRenew,
        autoClose: previous.autoClose,
        items: { create: previous.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          planId: item.planId,
          description: item.description,
          quantity: item.quantity,
          unitPricePaise: item.unitPricePaise,
          startDate,
          endDate: input.endDate,
        })) },
      },
      include: { customer: true, items: true },
    });
    await tx.auditLog.create({ data: { actorUserId: req.user.id, action: 'subscription.renewed', entityType: 'subscription', entityId: result.id, after: { renewedFromId: previous.id } } });
    return result;
  });
  return sendSuccess(res, renewed, 'Renewal created as a confirmed subscription.', 201);
}));

export default router;
