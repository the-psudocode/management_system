import { quotationService } from './quotation.service.js';
import { sendSuccess } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';

export class QuotationController {
  /**
   * GET /api/quotations
   * List quotations with pagination, status, and search filters
   * Access: Admin, Staff, or Customer (filtered to self)
   */
  async listQuotations(req, res, next) {
    try {
      const queryParams = { ...req.query };
      // If caller is customer, force customerId to their own customer ID
      if (req.user.role === 'customer') {
        if (!req.user.customer?.id) {
          throw ApiError.forbidden('Customer profile not found for user');
        }
        queryParams.customerId = req.user.customer.id;
      }

      const result = await quotationService.listQuotations(queryParams);
      return sendSuccess(res, result, 'Quotations retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/quotations/:id
   * Retrieve single quotation details
   * Access: Admin, Staff, or Customer (own quotation only)
   */
  async getQuotation(req, res, next) {
    try {
      const quotation = await quotationService.getQuotationById(req.params.id);
      if (!quotation) {
        throw ApiError.notFound(`Quotation with ID '${req.params.id}' not found`);
      }

      // Check customer ownership
      if (req.user.role === 'customer') {
        if (!req.user.customer?.id || quotation.customerId !== req.user.customer.id) {
          throw ApiError.forbidden('Access forbidden: Customers can view only their own quotations');
        }
      }

      return sendSuccess(res, quotation, 'Quotation details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/quotations
   * Create a new quotation
   * Access: Admin, Staff only
   */
  async createQuotation(req, res, next) {
    try {
      const quotation = await quotationService.createQuotation(req.body);
      return sendSuccess(res, quotation, 'Quotation created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/quotations/:id
   * Update draft quotation details
   * Access: Admin, Staff only
   */
  async updateQuotation(req, res, next) {
    try {
      const updated = await quotationService.updateQuotation(req.params.id, req.body);
      return sendSuccess(res, updated, 'Quotation updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/quotations/:id/status
   * Update quotation status
   * Access: Admin, Staff, or Customer (accept/decline own sent quotation)
   */
  async updateStatus(req, res, next) {
    try {
      const quotation = await quotationService.getQuotationById(req.params.id);
      if (!quotation) {
        throw ApiError.notFound(`Quotation with ID '${req.params.id}' not found`);
      }

      // Check customer ownership if caller is customer
      if (req.user.role === 'customer') {
        if (!req.user.customer?.id || quotation.customerId !== req.user.customer.id) {
          throw ApiError.forbidden('Access forbidden: Customers can update only their own quotations');
        }
      }

      const updated = await quotationService.updateQuotationStatus(
        req.params.id,
        req.body.status,
        req.user.role
      );
      return sendSuccess(res, updated, `Quotation status updated to '${req.body.status}'`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/quotations/:id/send
   * Mark draft quotation as sent
   * Access: Admin, Staff
   */
  async sendQuotation(req, res, next) {
    try {
      const updated = await quotationService.updateQuotationStatus(req.params.id, 'sent', req.user.role);
      return sendSuccess(res, updated, 'Quotation marked as sent to customer');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/quotations/:id/accept
   * Accept quotation
   * Access: Admin, Staff, or Customer (own quotation)
   */
  async acceptQuotation(req, res, next) {
    try {
      const quotation = await quotationService.getQuotationById(req.params.id);
      if (!quotation) {
        throw ApiError.notFound(`Quotation with ID '${req.params.id}' not found`);
      }

      if (req.user.role === 'customer') {
        if (!req.user.customer?.id || quotation.customerId !== req.user.customer.id) {
          throw ApiError.forbidden('Access forbidden: Customers can accept only their own quotations');
        }
      }

      const updated = await quotationService.updateQuotationStatus(req.params.id, 'accepted', req.user.role);
      return sendSuccess(res, updated, 'Quotation accepted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/quotations/:id/decline
   * Decline quotation
   * Access: Admin, Staff, or Customer (own quotation)
   */
  async declineQuotation(req, res, next) {
    try {
      const quotation = await quotationService.getQuotationById(req.params.id);
      if (!quotation) {
        throw ApiError.notFound(`Quotation with ID '${req.params.id}' not found`);
      }

      if (req.user.role === 'customer') {
        if (!req.user.customer?.id || quotation.customerId !== req.user.customer.id) {
          throw ApiError.forbidden('Access forbidden: Customers can decline only their own quotations');
        }
      }

      const updated = await quotationService.updateQuotationStatus(req.params.id, 'declined', req.user.role);
      return sendSuccess(res, updated, 'Quotation declined');
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/quotations/:id
   * Delete draft quotation
   * Access: Admin, Staff only
   */
  async deleteQuotation(req, res, next) {
    try {
      const result = await quotationService.deleteQuotation(req.params.id);
      return sendSuccess(res, result, 'Draft quotation deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const quotationController = new QuotationController();
export default quotationController;

