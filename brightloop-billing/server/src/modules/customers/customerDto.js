import { ApiError } from '../../utils/ApiError.js';
import { z } from 'zod';

// This selection deliberately mirrors columns present in the shared Neon schema.
// Keep it explicit because Prisma's default scalar selection includes fields that
// exist in the local schema but have not been added to the live database yet.
export const customerRecordSelect = {
  id: true,
  userId: true,
  companyName: true,
  phone: true,
  billingAddress: true,
  billingCity: true,
  billingStateCode: true,
  postalCode: true,
  billingCountry: true,
  gstin: true,
  accountBalancePaise: true,
  creditLimitPaise: true,
  createdAt: true,
  updatedAt: true,
};

export const customerSelect = {
  ...customerRecordSelect,
  user: { select: { id: true, name: true, email: true, status: true } },
};

export function serializeCustomer(customer) {
  if (!customer?.user) {
    throw ApiError.internal('Customer is missing its related user account.');
  }

  const status = String(customer.user.status ?? '').toLowerCase();
  if (status !== 'active' && status !== 'inactive') {
    throw ApiError.internal('Customer user account has an unsupported status.');
  }

  return {
    id: customer.id,
    name: customer.user.name ?? '',
    email: customer.user.email ?? '',
    phone: customer.phone ?? '',
    company: customer.companyName ?? '',
    address: customer.billingAddress ?? '',
    city: customer.billingCity ?? '',
    state: customer.billingStateCode ?? '',
    pincode: customer.postalCode ?? '',
    country: customer.billingCountry ?? '',
    gstin: customer.gstin ?? '',
    createdAt: customer.createdAt ?? '',
    status,
    accountBalancePaise: customer.accountBalancePaise ?? null,
    creditLimitPaise: customer.creditLimitPaise ?? null,
  };
}

export const unsupportedCustomerFields = [];

export const MAX_BIGINT_PAISE = 9223372036854775807n;

const money = z.string()
  .regex(/^\d+$/, 'Amount must be a non-negative integer string in paise.')
  .transform(BigInt)
  .refine((val) => val <= MAX_BIGINT_PAISE, `Amount cannot exceed PostgreSQL BIGINT maximum (${MAX_BIGINT_PAISE}).`);
const customerInput = z.object({
  userId: z.string().min(1),
  companyName: z.string().trim().max(200).optional(),
  company: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  billingAddress: z.string().trim().max(2000).optional(),
  address: z.string().trim().max(2000).optional(),
  city: z.string().trim().max(100).optional(),
  billingCity: z.string().trim().max(100).optional(),
  state: z.string().trim().max(3).optional(),
  billingStateCode: z.string().trim().max(3).optional(),
  pincode: z.string().trim().max(20).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(100).optional(),
  billingCountry: z.string().trim().max(100).optional(),
  gstin: z.string().trim().max(20).optional(),
  creditLimitPaise: money.optional(),
}).strict();

export function parseCustomerInput(body, partial = false) {
  const unsupported = unsupportedCustomerFields.filter((field) => Object.hasOwn(body ?? {}, field));
  if (unsupported.length) {
    throw ApiError.badRequest(`Customer fields are not supported by the current database schema: ${unsupported.join(', ')}.`);
  }
  if (body && (Object.hasOwn(body, 'name') || Object.hasOwn(body, 'email') || Object.hasOwn(body, 'status'))) {
    throw ApiError.badRequest('name, email, and status belong to the linked user account and cannot be changed through the customer API.');
  }
  if (body?.companyName !== undefined && body?.company !== undefined) throw ApiError.badRequest('Provide company or companyName, not both.');
  if (body?.billingAddress !== undefined && body?.address !== undefined) throw ApiError.badRequest('Provide address or billingAddress, not both.');
  if (body?.city !== undefined && body?.billingCity !== undefined) throw ApiError.badRequest('Provide city or billingCity, not both.');
  if (body?.state !== undefined && body?.billingStateCode !== undefined) throw ApiError.badRequest('Provide state or billingStateCode, not both.');
  if (body?.pincode !== undefined && body?.postalCode !== undefined) throw ApiError.badRequest('Provide pincode or postalCode, not both.');
  if (body?.country !== undefined && body?.billingCountry !== undefined) throw ApiError.badRequest('Provide country or billingCountry, not both.');
  const schema = partial ? customerInput.partial().omit({ userId: true }) : customerInput;
  const { company, address, city, state, pincode, country, ...fields } = schema.parse(body);
  return {
    ...fields,
    ...(company !== undefined ? { companyName: company } : {}),
    ...(address !== undefined ? { billingAddress: address } : {}),
    ...(city !== undefined ? { billingCity: city } : {}),
    ...(state !== undefined ? { billingStateCode: state.toUpperCase() } : {}),
    ...(pincode !== undefined ? { postalCode: pincode } : {}),
    ...(country !== undefined ? { billingCountry: country } : {}),
  };
}
