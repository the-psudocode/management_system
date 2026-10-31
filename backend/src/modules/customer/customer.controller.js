import { customerService } from './customer.service.js';
import { sendSuccess } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';

export class CustomerController {
  /**
   * GET /api/customers
   * Access: Admin, Staff
   */
  async listCustomers(req, res, next) {
    try {
      const result = await customerService.listCustomers(req.query);
      return sendSuccess(res, result, 'Customers retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/customers/:id
   * Access: Admin, Staff, or Customer (self only)
   */
  async getCustomer(req, res, next) {
    try {
      const customer = await customerService.getCustomerById(req.params.id);
      if (!customer) {
        throw ApiError.notFound(`Customer with ID '${req.params.id}' not found`);
      }
      return sendSuccess(res, customer, 'Customer details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/customers
   * Access: Admin, Staff
   */
  async createCustomer(req, res, next) {
    try {
      const customer = await customerService.createCustomer(req.body);
      return sendSuccess(res, customer, 'Customer account created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/customers/:id
   * Access: Admin, Staff, or Customer (self only)
   */
  async updateCustomer(req, res, next) {
    try {
      const updated = await customerService.updateCustomer(req.params.id, req.body);
      return sendSuccess(res, updated, 'Customer profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/customers/:id/status
   * Access: Admin only
   */
  async updateStatus(req, res, next) {
    try {
      const updated = await customerService.updateCustomerStatus(req.params.id, req.body.status);
      return sendSuccess(res, updated, 'Customer account status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/customers/:id/credit-limit
   * Access: Admin only
   */
  async updateCreditLimit(req, res, next) {
    try {
      const updated = await customerService.updateCustomerCreditLimit(
        req.params.id,
        req.body.creditLimitPaise
      );
      return sendSuccess(res, updated, 'Customer credit limit updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/customers/:id
   * Access: Admin only
   */
  async deactivateCustomer(req, res, next) {
    try {
      const result = await customerService.deactivateCustomer(req.params.id);
      return sendSuccess(res, result, 'Customer account deactivated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const customerController = new CustomerController();
export default customerController;

