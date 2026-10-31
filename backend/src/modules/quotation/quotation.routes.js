import { Router } from 'express';
import { quotationController } from './quotation.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  listQuotationsQuerySchema,
  quotationIdParamSchema,
  createQuotationSchema,
  updateQuotationSchema,
  updateQuotationStatusSchema
} from './quotation.validation.js';

export const createQuotationRouter = () => {
  const router = Router();

  // All quotation routes require authentication
  router.use(authenticate);

  /**
   * @route   GET /api/quotations
   * @desc    List quotations with pagination, status and search filters
   * @access  Protected (Admin, Staff, or Customer filtered to self)
   */
  router.get(
    '/',
    validate(listQuotationsQuerySchema, 'query'),
    quotationController.listQuotations
  );

  /**
   * @route   POST /api/quotations
   * @desc    Create a new quotation with items
   * @access  Protected (Admin, Staff only)
   */
  router.post(
    '/',
    authorizeRoles('admin', 'staff'),
    validate(createQuotationSchema, 'body'),
    quotationController.createQuotation
  );

  /**
   * @route   GET /api/quotations/:id
   * @desc    Retrieve quotation details by ID
   * @access  Protected (Admin, Staff, or Customer if own quotation)
   */
  router.get(
    '/:id',
    validate(quotationIdParamSchema, 'params'),
    quotationController.getQuotation
  );

  /**
   * @route   PUT /api/quotations/:id
   * @desc    Update draft quotation details and items
   * @access  Protected (Admin, Staff only)
   */
  router.put(
    '/:id',
    authorizeRoles('admin', 'staff'),
    validate(quotationIdParamSchema, 'params'),
    validate(updateQuotationSchema, 'body'),
    quotationController.updateQuotation
  );

  /**
   * @route   PATCH /api/quotations/:id/status
   * @desc    Update quotation status
   * @access  Protected (Admin, Staff, or Customer if accepting/declining)
   */
  router.patch(
    '/:id/status',
    validate(quotationIdParamSchema, 'params'),
    validate(updateQuotationStatusSchema, 'body'),
    quotationController.updateStatus
  );

  /**
   * @route   POST /api/quotations/:id/send
   * @desc    Mark quotation as sent
   * @access  Protected (Admin, Staff only)
   */
  router.post(
    '/:id/send',
    authorizeRoles('admin', 'staff'),
    validate(quotationIdParamSchema, 'params'),
    quotationController.sendQuotation
  );

  /**
   * @route   POST /api/quotations/:id/accept
   * @desc    Accept quotation
   * @access  Protected (Admin, Staff, or Customer if own quotation)
   */
  router.post(
    '/:id/accept',
    validate(quotationIdParamSchema, 'params'),
    quotationController.acceptQuotation
  );

  /**
   * @route   POST /api/quotations/:id/decline
   * @desc    Decline quotation
   * @access  Protected (Admin, Staff, or Customer if own quotation)
   */
  router.post(
    '/:id/decline',
    validate(quotationIdParamSchema, 'params'),
    quotationController.declineQuotation
  );

  /**
   * @route   DELETE /api/quotations/:id
   * @desc    Delete draft quotation
   * @access  Protected (Admin, Staff only)
   */
  router.delete(
    '/:id',
    authorizeRoles('admin', 'staff'),
    validate(quotationIdParamSchema, 'params'),
    quotationController.deleteQuotation
  );

  return router;
};

export const quotationRouter = createQuotationRouter();
export default quotationRouter;

