import { z } from 'zod';

/**
 * Query schema for GET /api/plans
 */
export const listPlansQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().optional(),
  status: z.enum(['all', 'active', 'inactive', 'archived']).default('all'),
  billing_interval: z.enum(['all', 'monthly', 'quarterly', 'yearly', 'weekly']).default('all'),
  billingInterval: z.enum(['all', 'monthly', 'quarterly', 'yearly', 'weekly']).optional(),
  productId: z.string().trim().optional(),
  product_id: z.string().trim().optional(),
  sortBy: z.enum(['created_at', 'name', 'amount_paise', 'billing_interval']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
}).transform((data) => ({
  ...data,
  limit: data.pageSize || data.limit,
  billing_interval: data.billingInterval || data.billing_interval,
  productId: data.productId || data.product_id
}));

/**
 * Route parameter validation schema for :id
 */
export const planIdParamSchema = z.object({
  id: z.string({ required_error: 'Plan ID is required' }).trim().min(1)
});

/**
 * Request body schema for POST /api/plans
 */
export const createPlanSchema = z.object({
  name: z.string({ required_error: 'Plan name is required' }).trim().min(1, 'Plan name cannot be empty'),
  productId: z.string().trim().min(1).optional(),
  product_id: z.string().trim().min(1).optional(),
  billingInterval: z.enum(['monthly', 'quarterly', 'yearly', 'weekly']).optional(),
  billing_interval: z.enum(['monthly', 'quarterly', 'yearly', 'weekly']).optional(),
  intervalCount: z.coerce.number().int().min(1).default(1).optional(),
  interval_count: z.coerce.number().int().min(1).default(1).optional(),
  amountPaise: z.coerce.number().int().nonnegative('Plan amount must be a non-negative integer in paise').optional(),
  amount_paise: z.coerce.number().int().nonnegative().optional(),
  priceInPaise: z.coerce.number().int().nonnegative().optional(),
  currency: z.string().trim().length(3).default('INR'),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
  description: z.string().trim().optional().nullable(),
  minimumQuantity: z.coerce.number().int().min(1).default(1).optional(),
  minimum_quantity: z.coerce.number().int().min(1).default(1).optional(),
  autoClose: z.boolean().default(false).optional(),
  auto_close: z.boolean().default(false).optional(),
  availableFrom: z.string().trim().optional().nullable(),
  available_from: z.string().trim().optional().nullable(),
  availableUntil: z.string().trim().optional().nullable(),
  available_until: z.string().trim().optional().nullable()
}).refine(
  (data) => Boolean(data.productId || data.product_id),
  { message: 'Product ID is required (productId or product_id)' }
).refine(
  (data) => Boolean(data.billingInterval || data.billing_interval),
  { message: 'Billing interval is required (monthly, quarterly, yearly, weekly)' }
).refine(
  (data) => data.amountPaise !== undefined || data.amount_paise !== undefined || data.priceInPaise !== undefined,
  { message: 'Amount in paise is required' }
).transform((data) => ({
  name: data.name,
  productId: data.productId || data.product_id,
  billingInterval: data.billingInterval || data.billing_interval,
  intervalCount: data.intervalCount !== undefined ? data.intervalCount : (data.interval_count !== undefined ? data.interval_count : 1),
  amountPaise: data.amountPaise !== undefined ? data.amountPaise : (data.amount_paise !== undefined ? data.amount_paise : data.priceInPaise),
  currency: data.currency,
  status: data.status,
  description: data.description || null,
  minimumQuantity: data.minimumQuantity !== undefined ? data.minimumQuantity : (data.minimum_quantity !== undefined ? data.minimum_quantity : 1),
  autoClose: data.autoClose !== undefined ? data.autoClose : (data.auto_close !== undefined ? data.auto_close : false),
  availableFrom: data.availableFrom || data.available_from || null,
  availableUntil: data.availableUntil || data.available_until || null
}));

/**
 * Request body schema for PUT /api/plans/:id
 */
export const updatePlanSchema = z.object({
  name: z.string().trim().min(1).optional(),
  productId: z.string().trim().min(1).optional(),
  product_id: z.string().trim().min(1).optional(),
  billingInterval: z.enum(['monthly', 'quarterly', 'yearly', 'weekly']).optional(),
  billing_interval: z.enum(['monthly', 'quarterly', 'yearly', 'weekly']).optional(),
  intervalCount: z.coerce.number().int().min(1).optional(),
  interval_count: z.coerce.number().int().min(1).optional(),
  amountPaise: z.coerce.number().int().nonnegative().optional(),
  amount_paise: z.coerce.number().int().nonnegative().optional(),
  priceInPaise: z.coerce.number().int().nonnegative().optional(),
  currency: z.string().trim().length(3).optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  description: z.string().trim().optional().nullable(),
  minimumQuantity: z.coerce.number().int().min(1).optional(),
  minimum_quantity: z.coerce.number().int().min(1).optional(),
  autoClose: z.boolean().optional(),
  auto_close: z.boolean().optional(),
  availableFrom: z.string().trim().optional().nullable(),
  available_from: z.string().trim().optional().nullable(),
  availableUntil: z.string().trim().optional().nullable(),
  available_until: z.string().trim().optional().nullable()
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
).transform((data) => ({
  name: data.name,
  productId: data.productId || data.product_id,
  billingInterval: data.billingInterval || data.billing_interval,
  intervalCount: data.intervalCount !== undefined ? data.intervalCount : data.interval_count,
  amountPaise: data.amountPaise !== undefined ? data.amountPaise : (data.amount_paise !== undefined ? data.amount_paise : data.priceInPaise),
  currency: data.currency,
  status: data.status,
  description: data.description,
  minimumQuantity: data.minimumQuantity !== undefined ? data.minimumQuantity : data.minimum_quantity,
  autoClose: data.autoClose !== undefined ? data.autoClose : data.auto_close,
  availableFrom: data.availableFrom !== undefined ? data.availableFrom : data.available_from,
  availableUntil: data.availableUntil !== undefined ? data.availableUntil : data.available_until
}));

/**
 * Request body schema for PATCH /api/plans/:id/status
 */
export const updatePlanStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'archived'], {
    errorMap: () => ({ message: 'Status must be active, inactive, or archived' })
  })
});

export default {
  listPlansQuerySchema,
  planIdParamSchema,
  createPlanSchema,
  updatePlanSchema,
  updatePlanStatusSchema
};

