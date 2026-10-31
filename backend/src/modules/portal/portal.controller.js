import { portalService } from './portal.service.js';
import { sendSuccess } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';

export class PortalController {
  /**
   * Helper to ensure authenticated caller has a linked customer profile
   */
  getCustomerId(req) {
    const customerId = req.user?.customer?.id;
    if (!customerId) {
      throw ApiError.forbidden('Access forbidden: Only registered customer accounts can access the customer portal');
    }
    return customerId;
  }

  /**
   * GET /api/portal/profile
   */
  async getProfile(req, res, next) {
    try {
      const customerId = this.getCustomerId(req);
      const profile = await portalService.getProfile(customerId);
      return sendSuccess(res, profile, 'Customer profile retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/portal/profile
   */
  async updateProfile(req, res, next) {
    try {
      const customerId = this.getCustomerId(req);
      const updated = await portalService.updateProfile(customerId, req.body);
      return sendSuccess(res, updated, 'Customer profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/portal/summary
   */
  async getSummary(req, res, next) {
    try {
      const customerId = this.getCustomerId(req);
      const summary = await portalService.getSummary(customerId);
      return sendSuccess(res, summary, 'Portal summary retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/portal/subscriptions
   */
  async listSubscriptions(req, res, next) {
    try {
      const customerId = this.getCustomerId(req);
      const result = await portalService.listSubscriptions(customerId, req.query);
      return sendSuccess(res, result, 'Subscriptions retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/portal/subscriptions/:id
   */
  async getSubscription(req, res, next) {
    try {
      const customerId = this.getCustomerId(req);
      const subscription = await portalService.getSubscriptionById(customerId, req.params.id);
      return sendSuccess(res, subscription, 'Subscription details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/portal/quotations
   */
  async listQuotations(req, res, next) {
    try {
      const customerId = this.getCustomerId(req);
      const result = await portalService.listQuotations(customerId, req.query);
      return sendSuccess(res, result, 'Quotations retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/portal/quotations/:id
   */
  async getQuotation(req, res, next) {
    try {
      const customerId = this.getCustomerId(req);
      const quotation = await portalService.getQuotationById(customerId, req.params.id);
      return sendSuccess(res, quotation, 'Quotation details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/portal/quotations/:id/accept
   */
  async acceptQuotation(req, res, next) {
    try {
      const customerId = this.getCustomerId(req);
      const updated = await portalService.acceptQuotation(customerId, req.params.id);
      return sendSuccess(res, updated, 'Quotation accepted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/portal/quotations/:id/decline
   */
  async declineQuotation(req, res, next) {
    try {
      const customerId = this.getCustomerId(req);
      const updated = await portalService.declineQuotation(customerId, req.params.id);
      return sendSuccess(res, updated, 'Quotation declined');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/portal/invoices
   */
  async listInvoices(req, res, next) {
    try {
      const customerId = this.getCustomerId(req);
      const result = await portalService.listInvoices(customerId, req.query);
      return sendSuccess(res, result, 'Invoices retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/portal/invoices/:id
   */
  async getInvoice(req, res, next) {
    try {
      const customerId = this.getCustomerId(req);
      const invoice = await portalService.getInvoiceById(customerId, req.params.id);
      return sendSuccess(res, invoice, 'Invoice details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/portal/payments
   */
  async listPayments(req, res, next) {
    try {
      const customerId = this.getCustomerId(req);
      const result = await portalService.listPayments(customerId, req.query);
      return sendSuccess(res, result, 'Payments retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/portal/payments/:id
   */
  async getPayment(req, res, next) {
    try {
      const customerId = this.getCustomerId(req);
      const payment = await portalService.getPaymentById(customerId, req.params.id);
      return sendSuccess(res, payment, 'Payment details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/portal/plans
   */
  async listPlans(req, res, next) {
    try {
      const result = await portalService.listPlans(req.query);
      return sendSuccess(res, result, 'Available subscription plans retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const portalController = new PortalController();
export default portalController;

