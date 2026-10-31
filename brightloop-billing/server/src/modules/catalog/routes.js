import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../database/index.js';
import { requireRole } from '../../middleware/authorize.js';
import { ApiError } from '../../utils/ApiError.js';
import { sendSuccess } from '../../utils/response.js';
import { asyncHandler, pagination, pageResult } from '../shared/handlers.js';

const router = Router();
const staff = requireRole('admin', 'staff');
const admin = requireRole('admin');
const idParam = z.string().min(1);
const money = z.string().regex(/^\d+$/, 'Amount must be a non-negative integer string in paise.').transform(BigInt);
const optionalMoney = z.string().regex(/^\d+$/).transform(BigInt).optional();

const customerInput = z.object({
  userId: z.string().min(1),
  companyName: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  billingAddress: z.string().trim().max(2000).optional(),
  billingCity: z.string().trim().max(120).optional(),
  billingStateCode: z.string().trim().max(20).optional(),
  postalCode: z.string().trim().max(20).optional(),
  gstin: z.string().trim().max(30).optional(),
  creditLimitPaise: optionalMoney,
});

router.get('/customers', requireRole('admin', 'staff', 'customer'), asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = pagination(req.query);
  const search = String(req.query.search || '').trim();
  const where = req.user.role.toLowerCase() === 'customer'
    ? { userId: req.user.id }
    : search
      ? { OR: [
          { companyName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
        ] }
      : {};
  const [data, total] = await prisma.$transaction([
    prisma.customer.findMany({ where, include: { user: { select: { id: true, email: true, name: true } } }, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.customer.count({ where }),
  ]);
  return sendSuccess(res, pageResult(data, total, page, pageSize));
}));

router.post('/customers', staff, asyncHandler(async (req, res) => {
  const input = customerInput.parse(req.body);
  const data = await prisma.customer.create({ data: input, include: { user: { select: { id: true, email: true, name: true } } } });
  return sendSuccess(res, data, 'Customer created.', 201);
}));

router.get('/customers/:id', requireRole('admin', 'staff', 'customer'), asyncHandler(async (req, res) => {
  const id = idParam.parse(req.params.id);
  const where = req.user.role.toLowerCase() === 'customer' ? { id, userId: req.user.id } : { id };
  const customer = await prisma.customer.findFirst({ where, include: { user: { select: { id: true, email: true, name: true } } } });
  if (!customer) throw ApiError.notFound('Customer not found.');
  return sendSuccess(res, customer);
}));

router.patch('/customers/:id', staff, asyncHandler(async (req, res) => {
  const id = idParam.parse(req.params.id);
  const input = customerInput.partial().omit({ userId: true }).parse(req.body);
  if (Object.keys(input).length === 0) throw ApiError.badRequest('Provide at least one customer field to update.');
  const customer = await prisma.customer.update({ where: { id }, data: input, include: { user: { select: { id: true, email: true, name: true } } } });
  return sendSuccess(res, customer, 'Customer updated.');
}));

const productInput = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.string().trim().min(1).max(60).default('service'),
  description: z.string().trim().max(4000).optional(),
  salesPricePaise: money,
  costPricePaise: money,
  variants: z.array(z.object({ sku: z.string().trim().min(1).max(100), name: z.string().trim().min(1).max(200), pricePaise: money, currency: z.string().length(3).default('INR') })).optional(),
});

router.get('/products', requireRole('admin', 'staff', 'customer'), asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = pagination(req.query);
  const search = String(req.query.search || '').trim();
  const where = { status: 'active', ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}) };
  const [data, total] = await prisma.$transaction([
    prisma.product.findMany({ where, select: { id: true, name: true, type: true, description: true, salesPricePaise: true, status: true, createdAt: true, variants: true }, orderBy: { name: 'asc' }, skip, take }),
    prisma.product.count({ where }),
  ]);
  return sendSuccess(res, pageResult(data, total, page, pageSize));
}));

router.post('/products', admin, asyncHandler(async (req, res) => {
  const input = productInput.parse(req.body);
  const { variants, ...product } = input;
  const data = await prisma.product.create({ data: { ...product, ...(variants ? { variants: { create: variants } } : {}) }, include: { variants: true } });
  return sendSuccess(res, data, 'Product created.', 201);
}));

router.get('/products/:id', requireRole('admin', 'staff', 'customer'), asyncHandler(async (req, res) => {
  const id = idParam.parse(req.params.id);
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true, name: true, type: true, description: true, salesPricePaise: true, status: true, createdAt: true, variants: true, plans: { where: { status: 'active' } } } });
  if (!product || (product.status !== 'active' && req.user.role.toLowerCase() === 'customer')) throw ApiError.notFound('Product not found.');
  return sendSuccess(res, product);
}));

router.patch('/products/:id', admin, asyncHandler(async (req, res) => {
  const id = idParam.parse(req.params.id);
  const input = productInput.partial().omit({ variants: true }).parse(req.body);
  if (Object.keys(input).length === 0) throw ApiError.badRequest('Provide at least one product field to update.');
  const data = await prisma.product.update({ where: { id }, data: input, include: { variants: true } });
  return sendSuccess(res, data, 'Product updated.');
}));

router.post('/products/:id/archive', admin, asyncHandler(async (req, res) => {
  const id = idParam.parse(req.params.id);
  const data = await prisma.product.update({ where: { id }, data: { status: 'archived' } });
  return sendSuccess(res, data, 'Product archived.');
}));

router.post('/products/:id/variants', admin, asyncHandler(async (req, res) => {
  const productId = idParam.parse(req.params.id);
  const input = z.object({ sku: z.string().trim().min(1).max(100), name: z.string().trim().min(1).max(200), pricePaise: money, currency: z.string().length(3).default('INR') }).parse(req.body);
  const data = await prisma.productVariant.create({ data: { productId, ...input } });
  return sendSuccess(res, data, 'Product variant created.', 201);
}));

const planInput = z.object({
  productId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  billingInterval: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
  intervalCount: z.number().int().positive().default(1),
  amountPaise: money,
  currency: z.string().length(3).default('INR'),
  description: z.string().trim().max(4000).optional(),
  minimumQuantity: z.number().int().positive().default(1),
  availableFrom: z.coerce.date().optional(),
  availableUntil: z.coerce.date().optional(),
  autoClose: z.boolean().default(false),
});

router.get('/plans', requireRole('admin', 'staff', 'customer'), asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = pagination(req.query);
  const search = String(req.query.search || '').trim();
  const where = { status: 'active', ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}) };
  const [data, total] = await prisma.$transaction([
    prisma.subscriptionPlan.findMany({ where, include: { product: { select: { id: true, name: true, type: true, description: true, status: true } } }, orderBy: { name: 'asc' }, skip, take }),
    prisma.subscriptionPlan.count({ where }),
  ]);
  return sendSuccess(res, pageResult(data, total, page, pageSize));
}));

router.post('/plans', admin, asyncHandler(async (req, res) => {
  const input = planInput.parse(req.body);
  if (input.availableFrom && input.availableUntil && input.availableUntil < input.availableFrom) throw ApiError.badRequest('availableUntil must be on or after availableFrom.');
  const data = await prisma.subscriptionPlan.create({ data: input, include: { product: { select: { id: true, name: true, type: true, description: true, status: true } } } });
  return sendSuccess(res, data, 'Subscription plan created.', 201);
}));

router.patch('/plans/:id', admin, asyncHandler(async (req, res) => {
  const id = idParam.parse(req.params.id);
  const input = planInput.partial().parse(req.body);
  if (Object.keys(input).length === 0) throw ApiError.badRequest('Provide at least one plan field to update.');
  const current = await prisma.subscriptionPlan.findUnique({ where: { id } });
  if (!current) throw ApiError.notFound('Subscription plan not found.');
  const from = input.availableFrom ?? current.availableFrom;
  const until = input.availableUntil ?? current.availableUntil;
  if (from && until && until < from) throw ApiError.badRequest('availableUntil must be on or after availableFrom.');
  const data = await prisma.subscriptionPlan.update({ where: { id }, data: input, include: { product: { select: { id: true, name: true, type: true, description: true, status: true } } } });
  return sendSuccess(res, data, 'Subscription plan updated.');
}));

router.post('/plans/:id/archive', admin, asyncHandler(async (req, res) => {
  const id = idParam.parse(req.params.id);
  const data = await prisma.subscriptionPlan.update({ where: { id }, data: { status: 'archived' } });
  return sendSuccess(res, data, 'Subscription plan archived.');
}));

export default router;
