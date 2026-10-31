import { Router } from 'express';
import { portalController } from './portal.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  updateProfileSchema,
  portalQuerySchema
} from './portal.validation.js';

export const createPortalRouter = () => {
  const router = Router();

  // All Customer Portal endpoints require authentication
  router.use(authenticate);

  /**
   * @route   GET /api/portal/profile
   * @desc    Get authenticated customer profile
   * @access  Protected (Customer)
   */
  router.get('/profile', portalController.getProfile.bind(portalController));

  /**
   * @route   PUT /api/portal/profile
   * @desc    Update permitted customer profile fields
   * @access  Protected (Customer)
   */
  router.put(
    '/profile',
    validate(updateProfileSchema, 'body'),
    portalController.updateProfile.bind(portalController)
  );

  /**
   * @route   GET /api/portal/summary
   * @desc    Dashboard overview of balances, counts, and recent invoices/payments
   * @access  Protected (Customer)
   */
  router.get('/summary', portalController.getSummary.bind(portalController));

  /**
   * @route   GET /api/portal/plans
   * @desc    Browse active subscription plans
   * @access  Protected (Customer)
   */
  router.get('/plans', portalController.listPlans.bind(portalController));

  /**
   * @route   GET /api/portal/subscriptions
   * @desc    List customer's subscriptions
   * @access  Protected (Customer)
   */
  router.get(
    '/subscriptions',
    validate(portalQuerySchema, 'query'),
    portalController.listSubscriptions.bind(portalController)
  );

  /**
   * @route   GET /api/portal/subscriptions/:id
   * @desc    Get subscription details by ID
   * @access  Protected (Customer)
   */
  router.get('/subscriptions/:id', portalController.getSubscription.bind(portalController));

  /**
   * @route   GET /api/portal/quotations
   * @desc    List customer's quotations
   * @access  Protected (Customer)
   */
  router.get(
    '/quotations',
    validate(portalQuerySchema, 'query'),
    portalController.listQuotations.bind(portalController)
  );

  /**
   * @route   GET /api/portal/quotations/:id
   * @desc    Get quotation details by ID
   * @access  Protected (Customer)
   */
  router.get('/quotations/:id', portalController.getQuotation.bind(portalController));

  /**
   * @route   POST /api/portal/quotations/:id/accept
   * @desc    Accept a quotation sent to the customer
   * @access  Protected (Customer)
   */
  router.post('/quotations/:id/accept', portalController.acceptQuotation.bind(portalController));

  /**
   * @route   POST /api/portal/quotations/:id/decline
   * @desc    Decline a quotation sent to the customer
   * @access  Protected (Customer)
   */
  router.post('/quotations/:id/decline', portalController.declineQuotation.bind(portalController));

  /**
   * @route   GET /api/portal/invoices
   * @desc    List customer's invoices
   * @access  Protected (Customer)
   */
  router.get(
    '/invoices',
    validate(portalQuerySchema, 'query'),
    portalController.listInvoices.bind(portalController)
  );

  /**
   * @route   GET /api/portal/invoices/:id
   * @desc    Get invoice details by ID
   * @access  Protected (Customer)
   */
  router.get('/invoices/:id', portalController.getInvoice.bind(portalController));

  /**
   * @route   GET /api/portal/payments
   * @desc    List customer's payment history
   * @access  Protected (Customer)
   */
  router.get(
    '/payments',
    validate(portalQuerySchema, 'query'),
    portalController.listPayments.bind(portalController)
  );

  /**
   * @route   GET /api/portal/payments/:id
   * @desc    Get payment details by ID
   * @access  Protected (Customer)
   */
  router.get('/payments/:id', portalController.getPayment.bind(portalController));

  return router;
};

export const portalRouter = createPortalRouter();
export default portalRouter;

