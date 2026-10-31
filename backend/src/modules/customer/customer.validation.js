import { z } from 'zod';
import { emailSchema, passwordSchema } from '../auth/auth.validation.js';

/**
 * Query schema for GET /api/customers
 * Supports pagination, text search (name, email, company_name), status filtering, and sorting
 */
export const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().optional(),
  status: z.enum(['all', 'active', 'inactive', 'suspended']).default('all'),
  sortBy: z.enum(['created_at', 'name', 'email', 'company_name']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
}).transform((data) => ({
  ...data,
  limit: data.pageSize || data.limit
}));

/**
 * Route parameter validation schema for :id
 */
export const customerIdParamSchema = z.object({
  id: z.string({ required_error: 'Customer ID is required' }).trim().min(1, 'Customer ID cannot be empty')
});

/**
 * Request body schema for POST /api/customers (Staff and Admin)
 * Never accepts 'role' from frontend (role is strictly enforced as 'customer' server-side).
 */
export const createCustomerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string({ required_error: 'Name is required' }).trim().min(1, 'Name cannot be empty'),
  phone: z.string().trim().optional().nullable(),
  companyName: z.string().trim().optional().nullable(),
  company_name: z.string().trim().optional().nullable(),
  billingAddress: z.string().trim().optional().nullable(),
  billing_address: z.string().trim().optional().nullable(),
  creditLimitPaise: z.coerce.number().int().nonnegative('Credit limit must be a non-negative integer in paise').default(0),
  credit_limit_paise: z.coerce.number().int().nonnegative().optional()
}).transform((data) => ({
  email: data.email,
  password: data.password,
  name: data.name,
  phone: data.phone || null,
  companyName: data.companyName || data.company_name || null,
  billingAddress: data.billingAddress || data.billing_address || null,
  creditLimitPaise: data.credit_limit_paise !== undefined ? data.credit_limit_paise : data.creditLimitPaise
}));

/**
 * Request body schema for PUT /api/customers/:id
 * Allows updating editable profile fields.
 * Restricted fields like status, role, credit limit, and balance are excluded.
 */
export const updateCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').optional(),
  phone: z.string().trim().optional().nullable(),
  companyName: z.string().trim().optional().nullable(),
  company_name: z.string().trim().optional().nullable(),
  billingAddress: z.string().trim().optional().nullable(),
  billing_address: z.string().trim().optional().nullable()
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field (name, phone, companyName, or billingAddress) must be provided for update' }
).transform((data) => ({
  name: data.name,
  phone: data.phone !== undefined ? data.phone : undefined,
  companyName: data.companyName !== undefined ? data.companyName : (data.company_name !== undefined ? data.company_name : undefined),
  billingAddress: data.billingAddress !== undefined ? data.billingAddress : (data.billing_address !== undefined ? data.billing_address : undefined)
}));

/**
 * Request body schema for PATCH /api/customers/:id/status (Admin only)
 */
export const updateCustomerStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended'], {
    errorMap: () => ({ message: 'Status must be one of: "active", "inactive", "suspended"' })
  })
});

/**
 * Request body schema for PATCH /api/customers/:id/credit-limit (Admin only)
 * Strictly validates that amount is a non-negative integer in paise.
 */
export const updateCustomerCreditLimitSchema = z.object({
  creditLimitPaise: z.coerce.number({
    required_error: 'creditLimitPaise is required',
    invalid_type_error: 'creditLimitPaise must be a number'
  }).int('Credit limit must be an integer').nonnegative('Credit limit must be greater than or equal to 0 paise').optional(),
  credit_limit_paise: z.coerce.number().int().nonnegative().optional()
}).refine(
  (data) => data.creditLimitPaise !== undefined || data.credit_limit_paise !== undefined,
  { message: 'creditLimitPaise or credit_limit_paise is required' }
).transform((data) => ({
  creditLimitPaise: data.credit_limit_paise !== undefined ? data.credit_limit_paise : data.creditLimitPaise
}));

export default {
  listCustomersQuerySchema,
  customerIdParamSchema,
  createCustomerSchema,
  updateCustomerSchema,
  updateCustomerStatusSchema,
  updateCustomerCreditLimitSchema
};

