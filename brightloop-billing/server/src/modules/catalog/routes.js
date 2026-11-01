import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../database/index.js';
import { requireRole } from '../../middleware/authorize.js';
import { ApiError } from '../../utils/ApiError.js';
import { sendSuccess } from '../../utils/response.js';
import { asyncHandler, pagination, pageResult } from '../shared/handlers.js';
import { customerSelect, serializeCustomer, parseCustomerInput } from '../customers/customerDto.js';

const router = Router();
const staff = requireRole('admin', 'staff');
const admin = requireRole('admin');
const planManager = requireRole('admin', 'staff');
const idParam = z.string().min(1);
const money = z.string().regex(/^\d+$/, 'Amount must be a non-negative integer string in paise.').transform(BigInt);
router.get('/customers', requireRole('admin', 'staff', 'customer'), asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = pagination(req.query);
  const search = String(req.query.search || '').trim();
  const where = req.user.role.toLowerCase() === 'customer'
    ? { userId: req.user.id }
    : {
        user: { role: 'customer' },
        ...(search ? { OR: [
          { companyName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { user: { name: { contains: search, mode: 'insensitive' } } },
        ] } : {}),
      };
  const [data, total] = await prisma.$transaction([
    prisma.customer.findMany({ where, select: customerSelect, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.customer.count({ where }),
  ]);
  return sendSuccess(res, pageResult(data.map(serializeCustomer), total, page, pageSize));
}));

router.post('/customers', staff, asyncHandler(async (req, res) => {
  const input = parseCustomerInput(req.body);
  const targetUser = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, role: true, status: true },
  });
  if (!targetUser) {
    throw ApiError.badRequest('The specified userId does not exist.');
  }
  if (targetUser.role.toLowerCase() !== 'customer') {
    throw ApiError.badRequest('A customer record can only be linked to an account with the customer role.');
  }
  const existingCustomer = await prisma.customer.findUnique({
    where: { userId: input.userId },
    select: { id: true },
  });
  if (existingCustomer) {
    throw ApiError.conflict('A customer profile is already linked to this user account.');
  }
  const data = await prisma.customer.create({ data: input, select: customerSelect });
  return sendSuccess(res, serializeCustomer(data), 'Customer created.', 201);
}));

router.get('/customers/:id', requireRole('admin', 'staff', 'customer'), asyncHandler(async (req, res) => {
  const id = idParam.parse(req.params.id);
  const where = req.user.role.toLowerCase() === 'customer' ? { id, userId: req.user.id } : { id };
  const customer = await prisma.customer.findFirst({ where, select: customerSelect });
  if (!customer) throw ApiError.notFound('Customer not found.');
  return sendSuccess(res, serializeCustomer(customer));
}));

router.patch('/customers/:id', staff, asyncHandler(async (req, res) => {
  const id = idParam.parse(req.params.id);
  const input = parseCustomerInput(req.body, true);
  if (Object.keys(input).length === 0) throw ApiError.badRequest('Provide at least one customer field to update.');
  const customer = await prisma.customer.update({ where: { id }, data: input, select: customerSelect });
  return sendSuccess(res, serializeCustomer(customer), 'Customer updated.');
}));

const productInput = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.string().trim().min(1).max(60).default('service'),
  description: z.string().trim().max(4000).optional(),
  salesPricePaise: money,
  costPricePaise: money,
  variants: z.array(z.object({ sku: z.string().trim().min(1).max(100), name: z.string().trim().min(1).max(200), pricePaise: money, currency: z.string().length(3).default('INR') })).optional(),
  plans: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    billingInterval: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly']),
    intervalCount: z.number().int().positive().default(1),
    amountPaise: money,
    currency: z.string().length(3).default('INR'),
    description: z.string().trim().max(4000).optional(),
    minimumQuantity: z.number().int().positive().default(1),
  })).optional(),
});

router.get('/products', requireRole('admin', 'staff', 'customer'), asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = pagination(req.query);
  const search = String(req.query.search || '').trim();
  const where = { status: 'active', ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}) };
  const productSelect = { id: true, name: true, type: true, description: true, salesPricePaise: true, ...(req.user.role.toLowerCase() === 'admin' ? { costPricePaise: true } : {}), status: true, createdAt: true, variants: true };
  const [data, total] = await prisma.$transaction([
    prisma.product.findMany({ where, select: productSelect, orderBy: { name: 'asc' }, skip, take }),
    prisma.product.count({ where }),
  ]);
  return sendSuccess(res, pageResult(data, total, page, pageSize));
}));

router.post('/products', admin, asyncHandler(async (req, res) => {
  const input = productInput.parse(req.body);
  const { variants, plans, ...product } = input;
  const data = await prisma.product.create({
    data: {
      ...product,
      ...(variants?.length ? { variants: { create: variants } } : {}),
      ...(plans?.length ? { plans: { create: plans } } : {}),
    },
    include: { variants: true, plans: true },
  });
  return sendSuccess(res, data, 'Product created.', 201);
}));

router.get('/products/:id', requireRole('admin', 'staff', 'customer'), asyncHandler(async (req, res) => {
  const id = idParam.parse(req.params.id);
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true, name: true, type: true, description: true, salesPricePaise: true, ...(req.user.role.toLowerCase() === 'admin' ? { costPricePaise: true } : {}), status: true, createdAt: true, variants: true, plans: { where: { status: 'active' } } } });
  if (!product || (product.status !== 'active' && req.user.role.toLowerCase() === 'customer')) throw ApiError.notFound('Product not found.');
  return sendSuccess(res, product);
}));

router.patch('/products/:id', admin, asyncHandler(async (req, res) => {
  const id = idParam.parse(req.params.id);
  const input = productInput.partial().omit({ variants: true, plans: true }).parse(req.body);
  if (Object.keys(input).length === 0) throw ApiError.badRequest('Provide at least one product field to update.');
  const data = await prisma.product.update({ where: { id }, data: input, include: { variants: true } });
  return sendSuccess(res, data, 'Product updated.');
}));

router.post('/products/:id/archive', admin, asyncHandler(async (req, res) => {
  const id = idParam.parse(req.params.id);
  const data = await prisma.$transaction(async (tx) => {
    await tx.subscriptionPlan.updateMany({ where: { productId: id, status: 'active' }, data: { status: 'archived' } });
    return tx.product.update({ where: { id }, data: { status: 'archived' } });
  });
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
  billingInterval: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly']),
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
  const where = { status: 'active', product: { status: 'active' }, ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}) };
  const [data, total] = await prisma.$transaction([
    prisma.subscriptionPlan.findMany({ where, include: { product: { select: { id: true, name: true, type: true, description: true, status: true, variants: true } } }, orderBy: [{ productId: 'asc' }, { name: 'asc' }], skip, take }),
    prisma.subscriptionPlan.count({ where }),
  ]);
  return sendSuccess(res, pageResult(data, total, page, pageSize));
}));

router.post('/plans', planManager, asyncHandler(async (req, res) => {
  const input = planInput.parse(req.body);
  if (input.availableFrom && input.availableUntil && input.availableUntil < input.availableFrom) throw ApiError.badRequest('availableUntil must be on or after availableFrom.');
  const data = await prisma.subscriptionPlan.create({ data: input, include: { product: { select: { id: true, name: true, type: true, description: true, status: true, variants: true } } } });
  return sendSuccess(res, data, 'Subscription plan created.', 201);
}));

router.patch('/plans/:id', planManager, asyncHandler(async (req, res) => {
  const id = idParam.parse(req.params.id);
  const input = planInput.partial().parse(req.body);
  if (Object.keys(input).length === 0) throw ApiError.badRequest('Provide at least one plan field to update.');
  const current = await prisma.subscriptionPlan.findUnique({ where: { id } });
  if (!current) throw ApiError.notFound('Subscription plan not found.');
  const from = input.availableFrom ?? current.availableFrom;
  const until = input.availableUntil ?? current.availableUntil;
  if (from && until && until < from) throw ApiError.badRequest('availableUntil must be on or after availableFrom.');
  const data = await prisma.subscriptionPlan.update({ where: { id }, data: input, include: { product: { select: { id: true, name: true, type: true, description: true, status: true, variants: true } } } });
  return sendSuccess(res, data, 'Subscription plan updated.');
}));

router.post('/plans/:id/archive', planManager, asyncHandler(async (req, res) => {
  const id = idParam.parse(req.params.id);
  const data = await prisma.subscriptionPlan.update({ where: { id }, data: { status: 'archived' } });
  return sendSuccess(res, data, 'Subscription plan archived.');
}));

export default router;
