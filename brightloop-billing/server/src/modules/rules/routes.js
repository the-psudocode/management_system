import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../database/index.js';
import { requireRole } from '../../middleware/authorize.js';
import { ApiError } from '../../utils/ApiError.js';
import { sendSuccess } from '../../utils/response.js';
import { asyncHandler } from '../shared/handlers.js';

const router = Router();
const amount = z.string().regex(/^[1-9]\d*$/, 'Use a positive integer amount in paise.').transform(BigInt);
const taxInput = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(['CGST', 'SGST', 'IGST', 'GST']),
  rateBps: z.number().int().positive().max(10000),
  scope: z.string().trim().min(1).max(80).default('all_products'),
  stateCode: z.string().trim().max(20).optional(),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
});

router.get('/tax-rules', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const data = await prisma.taxRule.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
  return sendSuccess(res, data);
}));

router.post('/tax-rules', requireRole('admin'), asyncHandler(async (req, res) => {
  const input = taxInput.parse(req.body);
  if (input.validFrom && input.validUntil && input.validUntil < input.validFrom) throw ApiError.badRequest('validUntil must be on or after validFrom.');
  const data = await prisma.taxRule.create({ data: input });
  return sendSuccess(res, data, 'Tax rule created.', 201);
}));

router.patch('/tax-rules/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const input = taxInput.partial().parse(req.body);
  if (Object.keys(input).length === 0) throw ApiError.badRequest('Provide at least one tax rule field to update.');
  const data = await prisma.taxRule.update({ where: { id }, data: input });
  return sendSuccess(res, data, 'Tax rule updated.');
}));

router.post('/tax-rules/:id/deactivate', requireRole('admin'), asyncHandler(async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const data = await prisma.taxRule.update({ where: { id }, data: { isActive: false } });
  return sendSuccess(res, data, 'Tax rule deactivated.');
}));

const discountInput = z.object({
  code: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).optional(),
  type: z.enum(['fixed', 'percentage']),
  value: z.union([amount, z.number().int().positive().max(10000).transform(BigInt)]),
  currency: z.string().length(3).default('INR'),
  minimumPurchasePaise: z.string().regex(/^\d+$/).transform(BigInt).optional(),
  minimumQuantity: z.number().int().positive().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  maxUses: z.number().int().positive().optional(),
  wholeSubscription: z.boolean().default(false),
  productIds: z.array(z.string().min(1)).default([]),
});

function validateDiscount(input) {
  if (input.endsAt < input.startsAt) throw ApiError.badRequest('endsAt must be on or after startsAt.');
  if (input.type === 'percentage' && input.value > 10000n) throw ApiError.badRequest('Percentage discount value is basis points and cannot exceed 10000 (100%).');
  if (!input.wholeSubscription && input.productIds.length === 0) throw ApiError.badRequest('Choose at least one eligible product or set wholeSubscription to true.');
}

router.get('/discounts', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const data = await prisma.discount.findMany({
    include: { products: { include: { product: { select: { id: true, name: true, type: true, status: true } } } } },
    orderBy: [{ isActive: 'desc' }, { startsAt: 'desc' }],
  });
  return sendSuccess(res, data);
}));

router.post('/discounts', requireRole('admin'), asyncHandler(async (req, res) => {
  const input = discountInput.parse(req.body);
  validateDiscount(input);
  const { productIds, ...discount } = input;
  const data = await prisma.discount.create({
    data: { ...discount, currency: discount.currency.toUpperCase(), products: { create: productIds.map((productId) => ({ productId })) } },
    include: { products: true },
  });
  return sendSuccess(res, data, 'Discount created.', 201);
}));

router.patch('/discounts/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const input = discountInput.partial().parse(req.body);
  if (Object.keys(input).length === 0) throw ApiError.badRequest('Provide at least one discount field to update.');
  const current = await prisma.discount.findUnique({ where: { id } });
  if (!current) throw ApiError.notFound('Discount not found.');
  if (input.maxUses != null && input.maxUses < current.usedCount) throw ApiError.badRequest('maxUses cannot be lower than the number already redeemed.');
  const { productIds, ...fields } = input;
  const data = await prisma.$transaction(async (tx) => {
    if (productIds) {
      await tx.discountProduct.deleteMany({ where: { discountId: id } });
      if (productIds.length) await tx.discountProduct.createMany({ data: productIds.map((productId) => ({ discountId: id, productId })) });
    }
    return tx.discount.update({ where: { id }, data: { ...fields, ...(fields.currency ? { currency: fields.currency.toUpperCase() } : {}) }, include: { products: true } });
  });
  return sendSuccess(res, data, 'Discount updated.');
}));

router.post('/discounts/:id/deactivate', requireRole('admin'), asyncHandler(async (req, res) => {
  const id = z.string().min(1).parse(req.params.id);
  const data = await prisma.discount.update({ where: { id }, data: { isActive: false } });
  return sendSuccess(res, data, 'Discount deactivated.');
}));

router.post('/subscriptions/:subscriptionId/discounts/:discountId', requireRole('admin', 'staff'), asyncHandler(async (req, res) => {
  const subscriptionId = z.string().min(1).parse(req.params.subscriptionId);
  const discountId = z.string().min(1).parse(req.params.discountId);
  const result = await prisma.$transaction(async (tx) => {
    const [subscription, discount] = await Promise.all([
      tx.subscription.findUnique({ where: { id: subscriptionId } }),
      tx.discount.findUnique({ where: { id: discountId }, include: { products: true } }),
    ]);
    if (!subscription) throw ApiError.notFound('Subscription not found.');
    if (!discount || !discount.isActive) throw ApiError.notFound('Active discount not found.');
    if (!['draft', 'quotation', 'confirmed', 'active', 'paused'].includes(subscription.status)) throw ApiError.conflict('Discounts cannot be applied to a closed subscription.');
    const link = await tx.subscriptionDiscount.create({ data: { subscriptionId, discountId } });
    await tx.auditLog.create({ data: { actorUserId: req.user.id, action: 'discount.applied_to_subscription', entityType: 'subscription', entityId: subscriptionId, after: { discountId } } });
    return link;
  });
  return sendSuccess(res, result, 'Discount will be evaluated during the next invoice run.', 201);
}));

export default router;
