import { Router } from 'express';
import { customerController } from './customer.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorizeRoles, authorizeCustomerSelfOrRoles } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  listCustomersQuerySchema,
  customerIdParamSchema,
  createCustomerSchema,
  updateCustomerSchema,
  updateCustomerStatusSchema,
  updateCustomerCreditLimitSchema
} from './customer.validation.js';

export const createCustomerRouter = () => {
  const router = Router();

  /**
   * @route   GET /api/customers
   * @desc    List customers with pagination, search, status filtering, and sorting
   * @access  Protected (Admin and Staff only)
   */
  router.get(
    '/',
    authenticate,
    authorizeRoles('admin', 'staff'),
    validate(listCustomersQuerySchema, 'query'),
    customerController.listCustomers
  );

  /**
   * @route   POST /api/customers
   * @desc    Create a new customer account
   * @access  Protected (Admin and Staff only)
   */
  router.post(
    '/',
    authenticate,
    authorizeRoles('admin', 'staff'),
    validate(createCustomerSchema, 'body'),
    customerController.createCustomer
  );

  /**
   * @route   GET /api/customers/:id
   * @desc    Retrieve customer details by customer ID
   * @access  Protected (Admin, Staff, or Customer if own profile)
   */
  router.get(
    '/:id',
    authenticate,
    validate(customerIdParamSchema, 'params'),
    authorizeCustomerSelfOrRoles({ paramKey: 'id', elevatedRoles: ['admin', 'staff'] }),
    customerController.getCustomer
  );

  /**
   * @route   PUT /api/customers/:id
   * @desc    Update customer details (name, company, phone, billing address)
   * @access  Protected (Admin, Staff, or Customer if own profile)
   */
  router.put(
    '/:id',
    authenticate,
    validate(customerIdParamSchema, 'params'),
    authorizeCustomerSelfOrRoles({ paramKey: 'id', elevatedRoles: ['admin', 'staff'] }),
    validate(updateCustomerSchema, 'body'),
    customerController.updateCustomer
  );

  /**
   * @route   PATCH /api/customers/:id/status
   * @desc    Update customer status ('active', 'inactive', 'suspended')
   * @access  Protected (Admin only)
   */
  router.patch(
    '/:id/status',
    authenticate,
    authorizeRoles('admin'),
    validate(customerIdParamSchema, 'params'),
    validate(updateCustomerStatusSchema, 'body'),
    customerController.updateStatus
  );

  /**
   * @route   PATCH /api/customers/:id/credit-limit
   * @desc    Update customer credit limit in paise
   * @access  Protected (Admin only)
   */
  router.patch(
    '/:id/credit-limit',
    authenticate,
    authorizeRoles('admin'),
    validate(customerIdParamSchema, 'params'),
    validate(updateCustomerCreditLimitSchema, 'body'),
    customerController.updateCreditLimit
  );

  /**
   * @route   DELETE /api/customers/:id
   * @desc    Safe deactivation/archival of a customer account
   * @access  Protected (Admin only)
   */
  router.delete(
    '/:id',
    authenticate,
    authorizeRoles('admin'),
    validate(customerIdParamSchema, 'params'),
    customerController.deactivateCustomer
  );

  return router;
};

export const customerRouter = createCustomerRouter();
export default customerRouter;
