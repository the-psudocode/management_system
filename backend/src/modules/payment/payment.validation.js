import { z } from 'zod';

/**
 * Query schema for GET /api/payments
 */
export const listPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().optional(),
  method: z.enum(['all', 'upi', 'bank_transfer', 'card', 'cash', 'cheque', 'other']).default('all'),
  customerId: z.string().trim().optional(),
  customer_id: z.string().trim().optional(),
  invoiceId: z.string().trim().optional(),
  invoice_id: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  sortBy: z.enum(['created_at', 'received_at', 'amount_paise']).default('received_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
}).transform((data) => ({
  ...data,
  limit: data.pageSize || data.limit,
  customerId: data.customerId || data.customer_id,
  invoiceId: data.invoiceId || data.invoice_id
}));

/**
 * Route parameter validation schema for :id
 */
export const paymentIdParamSchema = z.object({
  id: z.string({ required_error: 'Payment ID is required' }).trim().min(1)
});

/**
 * Request body schema for POST /api/payments
 */
export const createPaymentSchema = z.object({
  customerId: z.string().trim().min(1).optional(),
  customer_id: z.string().trim().min(1).optional(),
  amountPaise: z.coerce.number({ required_error: 'Payment amount is required' }).int().positive('Payment amount must be a positive integer in paise').optional(),
  amount_paise: z.coerce.number().int().positive().optional(),
  amountInPaise: z.coerce.number().int().positive().optional(),
  method: z.enum(['upi', 'bank_transfer', 'card', 'cash', 'cheque', 'other'], {
    errorMap: () => ({ message: 'Method must be upi, bank_transfer, card, cash, cheque, or other' })
  }),
  currency: z.string().trim().length(3).default('INR'),
  reference: z.string().trim().optional().nullable(),
  receivedAt: z.string().trim().optional().nullable(),
  received_at: z.string().trim().optional().nullable(),
  date: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  invoiceId: z.string().trim().optional().nullable(),
  invoice_id: z.string().trim().optional().nullable()
}).refine(
  (data) => Boolean(data.customerId || data.customer_id),
  { message: 'Customer ID is required' }
).refine(
  (data) => data.amountPaise !== undefined || data.amount_paise !== undefined || data.amountInPaise !== undefined,
  { message: 'Amount in paise is required' }
).transform((data) => ({
  customerId: data.customerId || data.customer_id,
  amountPaise: data.amountPaise !== undefined ? data.amountPaise : (data.amount_paise !== undefined ? data.amount_paise : data.amountInPaise),
  method: data.method,
  currency: data.currency,
  reference: data.reference || null,
  receivedAt: data.receivedAt || data.received_at || data.date || new Date().toISOString(),
  notes: data.notes || null,
  invoiceId: data.invoiceId || data.invoice_id || null
}));

export default {
  listPaymentsQuerySchema,
  paymentIdParamSchema,
  createPaymentSchema
};

