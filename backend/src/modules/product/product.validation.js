import { z } from 'zod';

/**
 * Query schema for GET /api/products
 */
export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().optional(),
  status: z.enum(['all', 'active', 'archived']).default('all'),
  type: z.string().trim().optional(),
  category: z.string().trim().optional(),
  sortBy: z.enum(['created_at', 'name', 'sales_price_paise']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
}).transform((data) => ({
  ...data,
  limit: data.pageSize || data.limit,
  type: data.type || data.category || undefined
}));

/**
 * Route parameter validation schema for :id or :productId
 */
export const productIdParamSchema = z.object({
  id: z.string().trim().min(1).optional(),
  productId: z.string().trim().min(1).optional()
}).refine((data) => Boolean(data.id || data.productId), {
  message: 'Product ID is required'
});

export const variantIdParamSchema = z.object({
  id: z.string().trim().min(1).optional(),
  variantId: z.string().trim().min(1).optional()
}).refine((data) => Boolean(data.id || data.variantId), {
  message: 'Variant ID is required'
});

export const productAndVariantParamsSchema = z.object({
  productId: z.string().trim().min(1).optional(),
  variantId: z.string().trim().min(1).optional(),
  id: z.string().trim().min(1).optional()
}).transform((data) => ({
  productId: data.productId || data.id,
  variantId: data.variantId || data.id
}));

/**
 * Schema for single variant item embedded inside product creation
 */
export const variantItemSchema = z.object({
  name: z.string({ required_error: 'Variant name is required' }).trim().min(1),
  sku: z.string({ required_error: 'SKU is required' }).trim().min(1),
  pricePaise: z.coerce.number().int().nonnegative('Variant price must be a non-negative integer in paise').optional(),
  price_paise: z.coerce.number().int().nonnegative().optional(),
  priceInPaise: z.coerce.number().int().nonnegative().optional(),
  currency: z.string().trim().length(3).default('INR')
}).transform((data) => ({
  name: data.name,
  sku: data.sku,
  pricePaise: data.price_paise !== undefined ? data.price_paise : (data.priceInPaise !== undefined ? data.priceInPaise : (data.pricePaise || 0)),
  currency: data.currency
}));

/**
 * Request body schema for POST /api/products
 */
export const createProductSchema = z.object({
  name: z.string({ required_error: 'Product name is required' }).trim().min(1, 'Name cannot be empty'),
  description: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  type: z.string().trim().optional(),
  category: z.string().trim().optional(),
  salesPricePaise: z.coerce.number().int().nonnegative('Sales price must be a non-negative integer in paise').optional(),
  sales_price_paise: z.coerce.number().int().nonnegative().optional(),
  basePriceInPaise: z.coerce.number().int().nonnegative().optional(),
  costPricePaise: z.coerce.number().int().nonnegative('Cost price must be a non-negative integer in paise').optional(),
  cost_price_paise: z.coerce.number().int().nonnegative().optional(),
  status: z.enum(['active', 'archived']).default('active'),
  variants: z.array(variantItemSchema).optional().default([])
}).transform((data) => ({
  name: data.name,
  description: data.description !== undefined ? data.description : (data.notes !== undefined ? data.notes : null),
  type: data.type || data.category || 'service',
  salesPricePaise: data.sales_price_paise !== undefined ? data.sales_price_paise : (data.basePriceInPaise !== undefined ? data.basePriceInPaise : (data.salesPricePaise || 0)),
  costPricePaise: data.cost_price_paise !== undefined ? data.cost_price_paise : (data.costPricePaise || 0),
  status: data.status,
  variants: data.variants
}));

/**
 * Request body schema for PUT /api/products/:id
 */
export const updateProductSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').optional(),
  description: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  type: z.string().trim().optional(),
  category: z.string().trim().optional(),
  salesPricePaise: z.coerce.number().int().nonnegative().optional(),
  sales_price_paise: z.coerce.number().int().nonnegative().optional(),
  basePriceInPaise: z.coerce.number().int().nonnegative().optional(),
  costPricePaise: z.coerce.number().int().nonnegative().optional(),
  cost_price_paise: z.coerce.number().int().nonnegative().optional(),
  status: z.enum(['active', 'archived']).optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
).transform((data) => ({
  name: data.name,
  description: data.description !== undefined ? data.description : (data.notes !== undefined ? data.notes : undefined),
  type: data.type || data.category || undefined,
  salesPricePaise: data.sales_price_paise !== undefined ? data.sales_price_paise : (data.basePriceInPaise !== undefined ? data.basePriceInPaise : data.salesPricePaise),
  costPricePaise: data.cost_price_paise !== undefined ? data.cost_price_paise : data.costPricePaise,
  status: data.status
}));

/**
 * Request body schema for PATCH /api/products/:id/status
 */
export const updateProductStatusSchema = z.object({
  status: z.enum(['active', 'archived'], {
    errorMap: () => ({ message: 'Status must be either "active" or "archived"' })
  })
});

/**
 * Request body schema for POST /api/products/:productId/variants
 */
export const createVariantSchema = z.object({
  name: z.string({ required_error: 'Variant name is required' }).trim().min(1),
  sku: z.string({ required_error: 'SKU is required' }).trim().min(1),
  pricePaise: z.coerce.number({
    required_error: 'Price in paise is required'
  }).int().nonnegative('Variant price must be a non-negative integer in paise').optional(),
  price_paise: z.coerce.number().int().nonnegative().optional(),
  priceInPaise: z.coerce.number().int().nonnegative().optional(),
  currency: z.string().trim().length(3).default('INR')
}).refine(
  (data) => data.pricePaise !== undefined || data.price_paise !== undefined || data.priceInPaise !== undefined,
  { message: 'pricePaise or price_paise is required' }
).transform((data) => ({
  name: data.name,
  sku: data.sku,
  pricePaise: data.price_paise !== undefined ? data.price_paise : (data.priceInPaise !== undefined ? data.priceInPaise : data.pricePaise),
  currency: data.currency
}));

/**
 * Request body schema for PUT /api/products/variants/:id or /api/products/:productId/variants/:id
 */
export const updateVariantSchema = z.object({
  name: z.string().trim().min(1).optional(),
  sku: z.string().trim().min(1).optional(),
  pricePaise: z.coerce.number().int().nonnegative().optional(),
  price_paise: z.coerce.number().int().nonnegative().optional(),
  priceInPaise: z.coerce.number().int().nonnegative().optional(),
  currency: z.string().trim().length(3).optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one variant field must be provided for update' }
).transform((data) => ({
  name: data.name,
  sku: data.sku,
  pricePaise: data.price_paise !== undefined ? data.price_paise : (data.priceInPaise !== undefined ? data.priceInPaise : data.pricePaise),
  currency: data.currency
}));

export default {
  listProductsQuerySchema,
  productIdParamSchema,
  variantIdParamSchema,
  productAndVariantParamsSchema,
  createProductSchema,
  updateProductSchema,
  updateProductStatusSchema,
  createVariantSchema,
  updateVariantSchema
};
