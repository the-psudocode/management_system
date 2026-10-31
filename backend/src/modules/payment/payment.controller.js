import { paymentService } from './payment.service.js';
import { sendSuccess } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';

export class PaymentController {
  /**
   * GET /api/payments
   * List payments with pagination, search, and filters
   * Access: Admin, Staff, or Customer (filtered to self)
   */
  async listPayments(req, res, next) {
    try {
      const queryParams = { ...req.query };
      if (req.user.role === 'customer') {
        if (!req.user.customer?.id) {
          throw ApiError.forbidden('Customer profile not found for user');
        }
        queryParams.customerId = req.user.customer.id;
      }

      const result = await paymentService.listPayments(queryParams);
      return sendSuccess(res, result, 'Payments retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/payments/:id
   * Retrieve single payment details by ID
   * Access: Admin, Staff, or Customer (own payment only)
   */
  async getPayment(req, res, next) {
    try {
      const payment = await paymentService.getPaymentById(req.params.id);
      if (!payment) {
        throw ApiError.notFound(`Payment with ID '${req.params.id}' not found`);
      }

      if (req.user.role === 'customer') {
        if (!req.user.customer?.id || payment.customerId !== req.user.customer.id) {
          throw ApiError.forbidden('Access forbidden: Customers can view only their own payments');
        }
      }

      return sendSuccess(res, payment, 'Payment details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/payments
   * Record a payment transaction
   * Access: Admin, Staff only
   */
  async createPayment(req, res, next) {
    try {
      const payment = await paymentService.createPayment(req.body);
      return sendSuccess(res, payment, 'Payment recorded successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/payments/stats
   * Summary payment volume and breakdown
   * Access: Admin, Staff
   */
  async getStats(req, res, next) {
    try {
      const customerId = req.user.role === 'customer' ? req.user.customer?.id : req.query.customerId;
      const stats = await paymentService.getPaymentStats(customerId);
      return sendSuccess(res, stats, 'Payment statistics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const paymentController = new PaymentController();
export default paymentController;

