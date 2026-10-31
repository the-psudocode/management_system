import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorizeRoles, authorizeSelfOrRoles } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  registerCustomerSchema,
  createStaffSchema,
  passwordResetSchema
} from './auth.validation.js';

export const createAuthRouter = () => {
  const router = Router();

  /**
   * @route   POST /api/auth/register
   * @desc    Public customer registration
   * @access  Public
   */
  router.post(
    '/register',
    validate(registerCustomerSchema),
    authController.registerCustomer
  );

  /**
   * @route   POST /api/auth/staff
   * @desc    Create staff or administrator accounts
   * @access  Protected (Admin only)
   */
  router.post(
    '/staff',
    authenticate,
    authorizeRoles('admin'),
    validate(createStaffSchema),
    authController.createStaff
  );

  /**
   * @route   POST /api/auth/password-reset
   * @desc    Request password reset link via Firebase Authentication
   * @access  Public
   */
  router.post(
    '/password-reset',
    validate(passwordResetSchema),
    authController.requestPasswordReset
  );

  /**
   * @route   GET /api/auth/me
   * @desc    Get current user profile and role from SQLite
   * @access  Protected (All authenticated users: admin, staff, customer)
   */
  router.get(
    '/me',
    authenticate,
    authController.getCurrentUser
  );

  /**
   * @route   GET /api/auth/users/:id
   * @desc    Retrieve user profile by ID (ensuring customers can access only their own records)
   * @access  Protected (Admin, Staff, or Customer if self)
   */
  router.get(
    '/users/:id',
    authenticate,
    authorizeSelfOrRoles({ paramKey: 'id', elevatedRoles: ['admin', 'staff'] }),
    authController.getUserRecord
  );

  return router;
};

export const authRouter = createAuthRouter();
export default authRouter;

