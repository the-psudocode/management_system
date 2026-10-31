import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import prisma from '../../database/index.js';
import { requireRole } from '../../middleware/authorize.js';
import { ApiError } from '../../utils/ApiError.js';
import { sendSuccess } from '../../utils/response.js';
import { asyncHandler, pagination, pageResult } from '../shared/handlers.js';
import { addBillingInterval, asDateOnly, calculateInvoice, invoiceDueDate } from './calculations.js';

const router = Router();
const dateInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((value) => asDateOnly(`${value}T00:00:00.000Z`));
const dueSubscriptionInclude = {
  customer: true,
  items: { include: { product: true, variant: true, plan: true } },
  discounts: { include: { discount: { include: { products: true } } }, orderBy: { appliedAt: 'asc' } },
};

function periodFor(subscription) {
  const start = asDateOnly(subscription.nextBillingDate);
  const next = addBillingInterval(start, subscription.billingInterval, subscription.intervalCount);
  const end = new Date(next);
  end.setUTCDate(end.getUTCDate() - 1);
  return { start, end, next };
}

function validDiscount(discount, subtotal, quantity, billingDate, items) {
  if (!discount.isActive || discount.startsAt > billingDate || discount.endsAt < billingDate) return false;
  if (discount.maxUses != null && discount.usedCount >= discount.maxUses) return false;
  const eligibleProductIds = new Set(discount.products.map(({ productId }) => productId));
  const eligible = discount.wholeSubscription
    ? { subtotal, quantity }
    : null;
  if (eligible) {
    if (discount.minimumPurchasePaise != null && eligible.subtotal < discount.minimumPurchasePaise) return false;
    if (discount.minimumQuantity != null && eligible.quantity < discount.minimumQuantity) return false;
    return true;
  }
  const matching = items.filter((item) => eligibleProductIds.has(item.productId));
  const matchingSubtotal = matching.reduce((sum, item) => sum + item.unitPricePaise * BigInt(item.quantity), 0n);
  const matchingQuantity = matching.reduce((sum, item) => sum + item.quantity, 0);
  return matching.length > 0
    && (discount.minimumPurchasePaise == null || matchingSubtotal >= discount.minimumPurchasePaise)
    && (discount.minimumQuantity == null || matchingQuantity >= discount.minimumQuantity);
}

async function invoicePreview(tx, subscription, billingDate, originState) {
  const period = periodFor(subscription);
  const subtotal = subscription.items.reduce((sum, item) => sum + item.unitPricePaise * BigInt(item.quantity), 0n);
  const quantity = subscription.items.reduce((sum, item) => sum + item.quantity, 0);
  const linked = subscription.discounts.map(({ discount }) => discount)
    .filter((discount) => validDiscount(discount, subtotal, quantity, billingDate, subscription.items));
  const taxRules = await tx.taxRule.findMany({ where: { isActive: true } });
  const calculation = calculateInvoice({
    items: subscription.items,
    discounts: linked,
    taxRules,
    customerState: subscription.customer.billingStateCode,
    originState,
    billingDate,
  });
  return {
    subscriptionId: subscription.id,
    subscriptionNumber: subscription.number,
    customerId: subscription.customerId,
    customerName: subscription.customer.companyName,
    currency: subscription.currency,
    billingPeriodStart: period.start,
    billingPeriodEnd: period.end,
    dueDate: invoiceDueDate(billingDate, subscription.paymentTerms),
    ...calculation,
  };
}

export async function runBillingDate(billingDate, actorUserId = null) {
  const originState = process.env.BUSINESS_STATE_CODE || null;
  const dueIds = await prisma.subscription.findMany({
    where: { status: 'active', nextBillingDate: { lte: billingDate } },
    select: { id: true },
    orderBy: { nextBillingDate: 'asc' },
    take: 500,
  });
  const created = [];
  const skipped = [];

  for (const { id } of dueIds) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const subscription = await tx.subscription.findUnique({ where: { id }, include: dueSubscriptionInclude });
        if (!subscription || subscription.status !== 'active' || !subscription.nextBillingDate || subscription.nextBillingDate > billingDate) return null;
        if (subscription.endDate && subscription.nextBillingDate > subscription.endDate) {
          await tx.subscription.update({ where: { id }, data: { nextBillingDate: null, ...(subscription.autoClose ? { status: 'closed', closedAt: new Date(), closeReason: 'Term ended' } : {}) } });
          return { invoice: null, reason: 'Term ended.' };
        }

        const period = periodFor(subscription);
        const billingPeriod = await tx.billingPeriod.upsert({
          where: { subscriptionId_periodStart_periodEnd: { subscriptionId: subscription.id, periodStart: period.start, periodEnd: period.end } },
          create: { subscriptionId: subscription.id, periodStart: period.start, periodEnd: period.end },
          update: {},
        });
        const priorActiveInvoice = await tx.invoice.findFirst({ where: { billingPeriodId: billingPeriod.id, status: { not: 'cancelled' } } });
        if (priorActiveInvoice) {
          const termEnded = Boolean(subscription.endDate && period.next > subscription.endDate);
          await tx.subscription.update({
            where: { id: subscription.id },
            data: { nextBillingDate: termEnded ? null : period.next, ...(termEnded && subscription.autoClose ? { status: 'closed', closedAt: new Date(), closeReason: 'Term ended' } : {}) },
          });
          return { invoice: null, reason: 'Billing period already has an active invoice; schedule advanced.' };
        }
        const priorRevisions = await tx.invoice.aggregate({ where: { billingPeriodId: billingPeriod.id }, _max: { revision: true } });
        const revision = (priorRevisions._max.revision || 0) + 1;
        const totalBeforeDiscounts = subscription.items.reduce((sum, item) => sum + item.unitPricePaise * BigInt(item.quantity), 0n);
        const totalQuantity = subscription.items.reduce((sum, item) => sum + item.quantity, 0);
        const candidates = subscription.discounts.map(({ discount }) => discount)
          .filter((discount) => validDiscount(discount, totalBeforeDiscounts, totalQuantity, billingDate, subscription.items));
        const claimed = [];
        for (const discount of candidates) {
          const where = {
            id: discount.id,
            isActive: true,
            startsAt: { lte: billingDate },
            endsAt: { gte: billingDate },
            ...(discount.maxUses == null ? {} : { usedCount: { lt: discount.maxUses } }),
          };
          const claim = await tx.discount.updateMany({ where, data: { usedCount: { increment: 1 } } });
          if (claim.count === 1) claimed.push(discount);
        }

        const taxRules = await tx.taxRule.findMany({ where: { isActive: true } });
        const calculation = calculateInvoice({
          items: subscription.items,
          discounts: claimed,
          taxRules,
          customerState: subscription.customer.billingStateCode,
          originState,
          billingDate,
        });
        const periodKey = period.start.toISOString().slice(0, 10).replaceAll('-', '');
        const invoiceNumber = `INV-${billingDate.getUTCFullYear()}-${subscription.number.split('-').at(-1)}-${periodKey}-R${revision}`;
        const invoice = await tx.invoice.create({
          data: {
            number: invoiceNumber,
            customerId: subscription.customerId,
            subscriptionId: subscription.id,
            billingPeriodId: billingPeriod.id,
            revision,
            currency: subscription.currency,
            billingPeriodStart: period.start,
            billingPeriodEnd: period.end,
            dueDate: invoiceDueDate(billingDate, subscription.paymentTerms),
            subtotalPaise: calculation.subtotalPaise,
            taxPaise: calculation.taxPaise,
            discountPaise: calculation.discountPaise,
            totalPaise: calculation.totalPaise,
            status: 'draft',
            items: { create: calculation.items.map(({ taxes, ...item }) => ({ ...item, taxes: { create: taxes } })) },
            discountRedemptions: { create: calculation.appliedDiscounts.map((discount) => ({ discountId: discount.discountId, amountPaise: discount.amountPaise })) },
          },
        });

        const termEnded = Boolean(subscription.endDate && period.next > subscription.endDate);
        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            nextBillingDate: termEnded ? null : period.next,
            ...(termEnded && subscription.autoClose ? { status: 'closed', closedAt: new Date(), closeReason: 'Term ended' } : {}),
          },
        });
        await tx.auditLog.create({ data: { actorUserId, action: 'invoice.generated', entityType: 'invoice', entityId: invoice.id, after: { subscriptionId: subscription.id, billingPeriodStart: periodKey } } });
        return { invoice, reason: null };
      });
      if (result?.invoice) created.push(result.invoice);
      else skipped.push({ subscriptionId: id, reason: result?.reason || 'No longer due.' });
    } catch (error) {
      if (error?.code === 'P2002') skipped.push({ subscriptionId: id, reason: 'Concurrent billing attempt won the unique billing-period claim.' });
      else throw error;
    }
  }

  const overdue = await prisma.invoice.updateMany({
    where: { status: { in: ['confirmed', 'partially_paid'] }, dueDate: { lt: billingDate } },
    data: { status: 'overdue' },
  });
  return { billingDate, created, createdCount: created.length, skipped, overdueMarked: overdue.count };
}

router.post('/billing/preview', requireRole('admin'), asyncHandler(async (req, res) => {
  const { billingDate } = z.object({ billingDate: dateInput }).parse(req.body);
  const due = await prisma.subscription.findMany({
    where: { status: 'active', nextBillingDate: { lte: billingDate } },
    include: dueSubscriptionInclude,
    orderBy: { nextBillingDate: 'asc' },
    take: 500,
  });
  const originState = process.env.BUSINESS_STATE_CODE || null;
  const previews = [];
  for (const subscription of due) previews.push(await invoicePreview(prisma, subscription, billingDate, originState));
  return sendSuccess(res, { billingDate, count: previews.length, invoices: previews }, 'Billing preview calculated without writing records.');
}));

router.post('/billing/run', requireRole('admin'), asyncHandler(async (req, res) => {
  const { billingDate } = z.object({ billingDate: dateInput }).parse(req.body);
  const result = await runBillingDate(billingDate, req.user.id);
  return sendSuccess(res, result, 'Billing run completed.');
}));
router.get('/invoices', requireRole('admin', 'staff', 'customer'), asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = pagination(req.query);
  const status = req.query.status ? String(req.query.status).toLowerCase() : undefined;
  const where = {
    ...(status ? { status: status.toLowerCase() } : {}),
    ...(req.user.role.toLowerCase() === 'customer' ? { customer: { userId: req.user.id } } : {}),
  };
  const [data, total] = await prisma.$transaction([
    prisma.invoice.findMany({ where, include: { customer: true, items: { include: { taxes: true } }, allocations: { include: { payment: true } } }, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.invoice.count({ where }),
  ]);
  return sendSuccess(res, pageResult(data, total, page, pageSize));
}));

router.get('/invoices/:id', requireRole('admin', 'staff', 'customer'), asyncHandler(async (req, res) => {
  const invoiceId = z.string().min(1).parse(req.params.id);
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, ...(req.user.role.toLowerCase() === 'customer' ? { customer: { userId: req.user.id } } : {}) },
    include: { customer: true, subscription: true, items: { include: { taxes: true } }, allocations: { include: { payment: true } }, discountRedemptions: { include: { discount: true } } },
  });
  if (!invoice) throw ApiError.notFound('Invoice not found.');
  return sendSuccess(res, invoice);
}));

router.post('/invoices/:id/confirm', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const invoiceId = z.string().min(1).parse(req.params.id);
  const invoice = await prisma.$transaction(async (tx) => {
    const current = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!current) throw ApiError.notFound('Invoice not found.');
    if (current.status !== 'draft') throw ApiError.conflict('Only draft invoices can be confirmed.');
    const updated = await tx.invoice.update({ where: { id: invoiceId }, data: { status: 'confirmed', issuedAt: new Date() } });
    await tx.auditLog.create({ data: { actorUserId: req.user.id, action: 'invoice.confirmed', entityType: 'invoice', entityId: invoiceId, before: { status: current.status }, after: { status: 'confirmed' } } });
    return updated;
  });
  return sendSuccess(res, invoice, 'Invoice confirmed.');
}));

router.post('/invoices/:id/cancel', requireRole('admin'), asyncHandler(async (req, res) => {
  const invoiceId = z.string().min(1).parse(req.params.id);
  const invoice = await prisma.$transaction(async (tx) => {
    const current = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { allocations: true, discountRedemptions: true } });
    if (!current) throw ApiError.notFound('Invoice not found.');
    if (!['draft', 'confirmed', 'overdue'].includes(current.status) || current.allocations.length > 0) throw ApiError.conflict('Only unpaid draft, confirmed, or overdue invoices can be cancelled.');
    const updated = await tx.invoice.update({ where: { id: invoiceId }, data: { status: 'cancelled' } });
    for (const redemption of current.discountRedemptions) {
      await tx.discount.updateMany({ where: { id: redemption.discountId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
    }
    await tx.discountRedemption.deleteMany({ where: { invoiceId } });
    const linkedSubscription = await tx.subscription.findUnique({ where: { id: current.subscriptionId }, select: { closeReason: true } });
    const reopenTermEndedSubscription = linkedSubscription?.closeReason === 'Term ended';
    await tx.subscription.updateMany({
      where: {
        id: current.subscriptionId,
        OR: [{ nextBillingDate: { gt: current.billingPeriodStart } }, { nextBillingDate: null }],
      },
      data: {
        nextBillingDate: current.billingPeriodStart,
        ...(reopenTermEndedSubscription ? { status: 'active', closedAt: null, closeReason: null } : {}),
      },
    });
    await tx.auditLog.create({ data: { actorUserId: req.user.id, action: 'invoice.cancelled', entityType: 'invoice', entityId: invoiceId, before: { status: current.status }, after: { status: 'cancelled' } } });
    return updated;
  });
  return sendSuccess(res, invoice, 'Invoice cancelled.');
}));

export default router;
