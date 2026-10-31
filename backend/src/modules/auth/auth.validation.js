import { z } from 'zod';

/**
 * Requirement 7: Password must be more than 8 characters (at least 9)
 * and contain at least one uppercase, one lowercase, and one special character.
 */
export const passwordSchema = z
  .string()
  .min(9, 'Password must be more than 8 characters long (minimum 9 characters)')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character');

export const emailSchema = z
  .string({ required_error: 'Email is required' })
  .email('Invalid email address format')
  .transform((val) => val.toLowerCase().trim());

/**
 * Requirement 4: Allow public customer registration.
 * Requirement 9: Never trust roles supplied by frontend requests.
 * The schema does not allow the client to specify a role; customer is strictly enforced.
 */
export const registerCustomerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string({ required_error: 'Name is required' }).trim().min(1, 'Name cannot be empty'),
  phone: z.string().trim().optional(),
  companyName: z.string().trim().optional(),
  billingAddress: z.string().trim().optional()
});

/**
 * Requirement 5: Only admin can create staff accounts.
 * Allows specifying 'staff' or 'admin' roles when created by an authorized admin.
 */
export const createStaffSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string({ required_error: 'Name is required' }).trim().min(1, 'Name cannot be empty'),
  role: z.enum(['staff', 'admin'], {
    errorMap: () => ({ message: 'Staff role must be either "staff" or "admin"' })
  }).default('staff')
});

/**
 * Requirement 11: Implement password reset through Firebase Authentication.
 */
export const passwordResetSchema = z.object({
  email: emailSchema
});

/**
 * Schema for token verification endpoint
 */
export const tokenVerificationSchema = z.object({
  idToken: z.string({ required_error: 'Firebase ID token is required' }).min(1, 'Token cannot be empty')
});

export default {
  passwordSchema,
  emailSchema,
  registerCustomerSchema,
  createStaffSchema,
  passwordResetSchema,
  tokenVerificationSchema
};

