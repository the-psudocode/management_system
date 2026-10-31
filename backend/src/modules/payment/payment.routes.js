import { Router } from 'express';
import { paymentController } from './payment.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  listPaymentsQuerySchema,
  paymentIdParamSchema,
  createPaymentSchema
} from './payment.validation.js';

export const createPaymentRouter = () => {
  const router = Router();

  // All payment routes require authentication
  router.use(authenticate);

  /**
   * @route   GET /api/payments/stats
   * @desc    Get aggregated payment statistics
   * @access  Protected (Admin, Staff)
   */
  router.get(
    '/stats',
    authorizeRoles('admin', 'staff'),
    paymentController.getStats
  );

  /**
   * @route   GET /api/payments
   * @desc    List payments with pagination, search, and filters
   * @access  Protected (Admin, Staff, or Customer filtered to self)
   */
  router.get(
    '/',
    validate(listPaymentsQuerySchema, 'query'),
    paymentController.listPayments
  );

  /**
   * @route   POST /api/payments
   * @desc    Record a new payment transaction
   * @access  Protected (Admin, Staff only)
   */
  router.post(
    '/',
    authorizeRoles('admin', 'staff'),
    validate(createPaymentSchema, 'body'),
    paymentController.createPayment
  );

  /**
   * @route   GET /api/payments/:id
   * @desc    Retrieve payment details by ID
   * @access  Protected (Admin, Staff, or Customer if own payment)
   */
  router.get(
    '/:id',
    validate(paymentIdParamSchema, 'params'),
    paymentController.getPayment
  );

  return router;
};

export const paymentRouter = createPaymentRouter();
export default paymentRouter;

