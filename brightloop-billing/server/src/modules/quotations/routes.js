import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import prisma from '../../database/index.js';
import { requireRole } from '../../middleware/authorize.js';
import { ApiError } from '../../utils/ApiError.js';
import { sendSuccess } from '../../utils/response.js';
import { asyncHandler, pagination, pageResult } from '../shared/handlers.js';
import { calculateInvoice } from '../billing/calculations.js';
import { customerRecordSelect } from '../customers/customerDto.js';

const router = Router();
const id = z.string().min(1);
const money = z.string().regex(/^\d+$/).transform(BigInt);
const itemInput = z.object({
  productId: id,
  variantId: id.optional(),
  planId: id.optional(),
  quantity: z.number().int().positive(),
  unitPricePaise: money.optional(),
  description: z.string().trim().max(500).optional(),
});

router.get('/quotation-templates', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const templates = await prisma.quotationTemplate.findMany({ include: { items: { include: { product: { select: { id: true, name: true, type: true, status: true } }, plan: true } } }, orderBy: { name: 'asc' } });
  return sendSuccess(res, templates);
}));

router.post('/quotation-templates', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const input = z.object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).optional(),
    validDays: z.number().int().positive().max(365).default(30),
    items: z.array(z.object({ productId: id, planId: id.optional(), quantity: z.number().int().positive() })).min(1),
  }).parse(req.body);
  const template = await prisma.quotationTemplate.create({
    data: { ...input, items: { create: input.items } },
    include: { items: true },
  });
  return sendSuccess(res, template, 'Quotation template created.', 201);
}));

router.get('/quotations', requireRole('admin', 'staff', 'customer'), asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = pagination(req.query);
  const where = req.user.role.toLowerCase() === 'customer' ? { customer: { userId: req.user.id } } : {};
  const [data, total] = await prisma.$transaction([
    prisma.quotation.findMany({ where, include: { customer: { select: customerRecordSelect }, items: { include: { taxes: true } }, subscription: true }, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.quotation.count({ where }),
  ]);
  return sendSuccess(res, pageResult(data, total, page, pageSize));
}));

router.get('/quotations/:id', requireRole('admin', 'staff', 'customer'), asyncHandler(async (req, res) => {
  const quotationId = id.parse(req.params.id);
  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, ...(req.user.role.toLowerCase() === 'customer' ? { customer: { userId: req.user.id } } : {}) },
    include: { customer: { select: customerRecordSelect }, items: { include: { taxes: true } }, subscription: true },
  });
  if (!quotation) throw ApiError.notFound('Quotation not found.');
  return sendSuccess(res, quotation);
}));

router.post('/quotations', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const input = z.object({
    customerId: id,
    templateId: id.optional(),
    validDays: z.number().int().positive().max(365).optional(),
    paymentTerms: z.string().trim().max(1000).optional(),
    notes: z.string().trim().max(2000).optional(),
    items: z.array(itemInput).min(1).optional(),
  }).refine((value) => Boolean(value.templateId) !== Boolean(value.items), 'Provide either templateId or items.').parse(req.body);

  const customer = await prisma.customer.findUnique({ where: { id: input.customerId }, select: customerRecordSelect });
  if (!customer) throw ApiError.notFound('Customer not found.');
  let sourceItems;
  let template = null;
  if (input.templateId) {
    template = await prisma.quotationTemplate.findUnique({ where: { id: input.templateId }, include: { items: true } });
    if (!template || !template.isActive) throw ApiError.notFound('Active quotation template not found.');
    sourceItems = template.items;
  } else {
    sourceItems = input.items;
  }

  const lineItems = [];
  for (const source of sourceItems) {
    const product = await prisma.product.findUnique({ where: { id: source.productId } });
    if (!product || product.status !== 'active') throw ApiError.badRequest('A quotation item refers to an inactive or missing product.');
    const variantId = source.variantId || null;
    const variant = variantId ? await prisma.productVariant.findFirst({ where: { id: variantId, productId: product.id } }) : null;
    if (variantId && !variant) throw ApiError.badRequest('A quotation variant must belong to the selected product.');
    const plan = source.planId ? await prisma.subscriptionPlan.findUnique({ where: { id: source.planId } }) : null;
    if (source.planId && (!plan || plan.productId !== product.id || plan.status !== 'active')) throw ApiError.badRequest('A quotation plan must be active and belong to the selected product.');
    lineItems.push({
      productId: product.id,
      variantId,
      planId: plan?.id || null,
      quantity: source.quantity,
      description: source.description || (plan ? `${product.name} - ${plan.name}` : product.name),
      unitPricePaise: source.unitPricePaise ?? (plan?.amountPaise ?? variant?.pricePaise ?? product.salesPricePaise),
    });
  }

  const now = new Date();
  const validity = input.validDays || template?.validDays || 30;
  const validUntil = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + validity));
  const taxRules = await prisma.taxRule.findMany({ where: { isActive: true } });
  const originState = process.env.BUSINESS_STATE_CODE || null;
  const calculation = calculateInvoice({ items: lineItems, discounts: [], taxRules, customerState: null, originState, billingDate: now });
  const quoteNumber = `QUO-${now.getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const quotation = await prisma.$transaction(async (tx) => {
    const result = await tx.quotation.create({
      data: {
        number: quoteNumber,
        customerId: customer.id,
        templateId: template?.id,
        paymentTerms: input.paymentTerms,
        notes: input.notes,
        validUntil,
        subtotalPaise: calculation.subtotalPaise,
        taxPaise: calculation.taxPaise,
        discountPaise: calculation.discountPaise,
        totalPaise: calculation.totalPaise,
        items: { create: calculation.items.map(({ taxes, ...item }) => ({ ...item, taxes: { create: taxes } })) },
      },
      include: { customer: { select: customerRecordSelect }, items: { include: { taxes: true } } },
    });
    await tx.auditLog.create({ data: { actorUserId: req.user.id, action: 'quotation.created', entityType: 'quotation', entityId: result.id, after: { number: result.number } } });
    return result;
  });
  return sendSuccess(res, quotation, 'Quotation created as a draft.', 201);
}));

router.post('/quotations/:id/send', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const quotationId = id.parse(req.params.id);
  const quotation = await prisma.$transaction(async (tx) => {
    const current = await tx.quotation.findUnique({ where: { id: quotationId } });
    if (!current) throw ApiError.notFound('Quotation not found.');
    if (current.status !== 'draft') throw ApiError.conflict('Only a draft quotation can be sent.');
    const data = await tx.quotation.update({ where: { id: quotationId }, data: { status: 'sent' } });
    await tx.auditLog.create({ data: { actorUserId: req.user.id, action: 'quotation.marked_sent', entityType: 'quotation', entityId: quotationId } });
    return data;
  });
  return sendSuccess(res, quotation, 'Quotation marked as sent. Email delivery is not configured yet.');
}));

router.post('/quotations/:id/accept', requireRole('admin', 'staff', 'customer'), asyncHandler(async (req, res) => {
  const quotationId = id.parse(req.params.id);
  const quotation = await prisma.quotation.findFirst({ where: { id: quotationId, ...(req.user.role.toLowerCase() === 'customer' ? { customer: { userId: req.user.id } } : {}) } });
  if (!quotation) throw ApiError.notFound('Quotation not found.');
  if (quotation.status !== 'sent') throw ApiError.conflict('Only a sent quotation can be accepted.');
  if (quotation.validUntil < new Date()) throw ApiError.conflict('This quotation has expired.');
  const updated = await prisma.quotation.update({ where: { id: quotationId }, data: { status: 'accepted' } });
  return sendSuccess(res, updated, 'Quotation accepted.');
}));

router.post('/quotations/:id/convert', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const quotationId = id.parse(req.params.id);
  const input = z.object({ startDate: z.coerce.date().optional(), endDate: z.coerce.date().optional(), autoRenew: z.boolean().default(true) }).parse(req.body);
  if (input.endDate && input.startDate && input.endDate < input.startDate) throw ApiError.badRequest('endDate must be on or after startDate.');

  const subscription = await prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUnique({ where: { id: quotationId }, include: { items: true } });
    if (!quotation) throw ApiError.notFound('Quotation not found.');
    if (quotation.status !== 'accepted') throw ApiError.conflict('Accept the quotation before converting it to a subscription.');
    if (quotation.validUntil < new Date()) throw ApiError.conflict('This quotation has expired.');
    if (quotation.items.some((item) => !item.planId)) throw ApiError.badRequest('Every quotation line needs a subscription plan to convert to a subscription.');
    const planIds = [...new Set(quotation.items.map((item) => item.planId))];
    const plans = await tx.subscriptionPlan.findMany({ where: { id: { in: planIds } } });
    if (plans.length !== planIds.length) throw ApiError.conflict('A subscription plan on this quotation no longer exists.');
    const cadence = `${plans[0].billingInterval}:${plans[0].intervalCount}`;
    if (plans.some((plan) => `${plan.billingInterval}:${plan.intervalCount}` !== cadence)) throw ApiError.badRequest('All lines in a subscription must use the same billing cadence.');
    const planById = new Map(plans.map((plan) => [plan.id, plan]));
    const now = new Date();
    const startDate = input.startDate || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const result = await tx.subscription.create({
      data: {
        number: `SUB-${now.getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        customerId: quotation.customerId,
        sourceQuotationId: quotation.id,
        status: 'confirmed',
        currency: quotation.currency,
        paymentTerms: quotation.paymentTerms,
        startDate,
        endDate: input.endDate,
        autoRenew: input.autoRenew,
        autoClose: plans.some((plan) => plan.autoClose),
        billingInterval: plans[0].billingInterval,
        intervalCount: plans[0].intervalCount,
        items: { create: quotation.items.map((item) => ({
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
      include: { customer: { select: customerRecordSelect }, items: true },
    });
    await tx.quotation.update({ where: { id: quotation.id }, data: { status: 'converted' } });
    await tx.auditLog.create({ data: { actorUserId: req.user.id, action: 'quotation.converted', entityType: 'quotation', entityId: quotation.id, after: { subscriptionId: result.id } } });
    await tx.auditLog.create({ data: { actorUserId: req.user.id, action: 'subscription.created_from_quotation', entityType: 'subscription', entityId: result.id, after: { quotationId: quotation.id } } });
    return result;
  });
  return sendSuccess(res, subscription, 'Quotation converted to a confirmed subscription.', 201);
}));

export default router;
