import { z } from 'zod';

/**
 * Schema for updating customer profile from the portal
 */
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).optional(),
  companyName: z.string().trim().min(1).optional(),
  company_name: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
  billingAddress: z.string().trim().min(1).optional(),
  billing_address: z.string().trim().min(1).optional(),
  billingCity: z.string().trim().optional().nullable(),
  billing_city: z.string().trim().optional().nullable(),
  billingStateCode: z.string().trim().max(10).optional().nullable(),
  billing_state_code: z.string().trim().max(10).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  postal_code: z.string().trim().max(20).optional().nullable(),
  gstin: z.string().trim().max(25).optional().nullable()
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for profile update' }
).transform((data) => ({
  name: data.name,
  companyName: data.companyName || data.company_name,
  phone: data.phone,
  billingAddress: data.billingAddress || data.billing_address,
  billingCity: data.billingCity !== undefined ? data.billingCity : data.billing_city,
  billingStateCode: data.billingStateCode !== undefined ? data.billingStateCode : data.billing_state_code,
  postalCode: data.postalCode !== undefined ? data.postalCode : data.postal_code,
  gstin: data.gstin
}));

/**
 * Common pagination query schema for portal lists
 */
export const portalQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  status: z.string().trim().default('all')
}).transform((data) => ({
  page: data.page,
  limit: data.pageSize || data.limit,
  status: data.status
}));

export default {
  updateProfileSchema,
  portalQuerySchema
};

