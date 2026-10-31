import { z } from 'zod';

/**
 * Single item in a quotation
 */
export const quotationItemSchema = z.object({
  productId: z.string().trim().min(1).optional(),
  product_id: z.string().trim().min(1).optional(),
  variantId: z.string().trim().optional().nullable(),
  variant_id: z.string().trim().optional().nullable(),
  planId: z.string().trim().optional().nullable(),
  plan_id: z.string().trim().optional().nullable(),
  description: z.string({ required_error: 'Item description is required' }).trim().min(1),
  quantity: z.coerce.number().int().min(1).default(1),
  unitPricePaise: z.coerce.number().int().nonnegative().optional(),
  unit_price_paise: z.coerce.number().int().nonnegative().optional(),
  discountPaise: z.coerce.number().int().nonnegative().default(0).optional(),
  discount_paise: z.coerce.number().int().nonnegative().default(0).optional(),
  taxPaise: z.coerce.number().int().nonnegative().default(0).optional(),
  tax_paise: z.coerce.number().int().nonnegative().default(0).optional()
}).refine(
  (data) => Boolean(data.productId || data.product_id),
  { message: 'Product ID is required for each quotation item' }
).refine(
  (data) => data.unitPricePaise !== undefined || data.unit_price_paise !== undefined,
  { message: 'Unit price in paise is required' }
).transform((data) => ({
  productId: data.productId || data.product_id,
  variantId: data.variantId || data.variant_id || null,
  planId: data.planId || data.plan_id || null,
  description: data.description,
  quantity: data.quantity,
  unitPricePaise: data.unitPricePaise !== undefined ? data.unitPricePaise : data.unit_price_paise,
  discountPaise: data.discountPaise !== undefined ? data.discountPaise : (data.discount_paise !== undefined ? data.discount_paise : 0),
  taxPaise: data.taxPaise !== undefined ? data.taxPaise : (data.tax_paise !== undefined ? data.tax_paise : 0)
}));

/**
 * Query schema for GET /api/quotations
 */
export const listQuotationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().optional(),
  status: z.enum(['all', 'draft', 'sent', 'accepted', 'declined', 'expired', 'converted']).default('all'),
  customerId: z.string().trim().optional(),
  customer_id: z.string().trim().optional(),
  sortBy: z.enum(['created_at', 'issued_at', 'valid_until', 'total_paise', 'number']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
}).transform((data) => ({
  ...data,
  limit: data.pageSize || data.limit,
  customerId: data.customerId || data.customer_id
}));

/**
 * Route parameter validation schema for :id
 */
export const quotationIdParamSchema = z.object({
  id: z.string({ required_error: 'Quotation ID is required' }).trim().min(1)
});

/**
 * Request body schema for POST /api/quotations
 */
export const createQuotationSchema = z.object({
  customerId: z.string().trim().min(1).optional(),
  customer_id: z.string().trim().min(1).optional(),
  templateId: z.string().trim().optional().nullable(),
  template_id: z.string().trim().optional().nullable(),
  currency: z.string().trim().length(3).default('INR'),
  paymentTerms: z.string().trim().optional().nullable(),
  payment_terms: z.string().trim().optional().nullable(),
  validUntil: z.string({ required_error: 'Validity date (validUntil) is required' }).trim().min(1),
  notes: z.string().trim().optional().nullable(),
  items: z.array(quotationItemSchema).min(1, 'Quotation must include at least one item')
}).refine(
  (data) => Boolean(data.customerId || data.customer_id),
  { message: 'Customer ID is required' }
).transform((data) => ({
  customerId: data.customerId || data.customer_id,
  templateId: data.templateId || data.template_id || null,
  currency: data.currency,
  paymentTerms: data.paymentTerms || data.payment_terms || null,
  validUntil: data.validUntil,
  notes: data.notes || null,
  items: data.items
}));

/**
 * Request body schema for PUT /api/quotations/:id
 */
export const updateQuotationSchema = z.object({
  validUntil: z.string().trim().optional(),
  paymentTerms: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  items: z.array(quotationItemSchema).min(1).optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

/**
 * Request body schema for status update
 */
export const updateQuotationStatusSchema = z.object({
  status: z.enum(['draft', 'sent', 'accepted', 'declined', 'expired'], {
    errorMap: () => ({ message: 'Status must be draft, sent, accepted, declined, or expired' })
  })
});

export default {
  quotationItemSchema,
  listQuotationsQuerySchema,
  quotationIdParamSchema,
  createQuotationSchema,
  updateQuotationSchema,
  updateQuotationStatusSchema
};

