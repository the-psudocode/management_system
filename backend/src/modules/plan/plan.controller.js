import { planService } from './plan.service.js';
import { sendSuccess } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';

export class PlanController {
  /**
   * GET /api/plans
   * List subscription plans with pagination, search, status, and interval filters
   * Access: Admin, Staff
   */
  async listPlans(req, res, next) {
    try {
      const result = await planService.listPlans(req.query);
      return sendSuccess(res, result, 'Subscription plans retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/plans/:id
   * Retrieve single plan details by ID
   * Access: Admin, Staff
   */
  async getPlan(req, res, next) {
    try {
      const plan = await planService.getPlanById(req.params.id);
      if (!plan) {
        throw ApiError.notFound(`Subscription plan with ID '${req.params.id}' not found`);
      }
      return sendSuccess(res, plan, 'Subscription plan details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/plans
   * Create a new subscription plan
   * Access: Admin, Staff
   */
  async createPlan(req, res, next) {
    try {
      const plan = await planService.createPlan(req.body);
      return sendSuccess(res, plan, 'Subscription plan created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/plans/:id
   * Update subscription plan details
   * Access: Admin, Staff
   */
  async updatePlan(req, res, next) {
    try {
      const updated = await planService.updatePlan(req.params.id, req.body);
      return sendSuccess(res, updated, 'Subscription plan updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/plans/:id/status
   * Update subscription plan status
   * Access: Admin, Staff
   */
  async updateStatus(req, res, next) {
    try {
      const updated = await planService.updatePlanStatus(req.params.id, req.body.status);
      return sendSuccess(res, updated, 'Subscription plan status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/plans/:id
   * Safely archive a subscription plan
   * Access: Admin, Staff
   */
  async deletePlan(req, res, next) {
    try {
      const result = await planService.deletePlan(req.params.id);
      return sendSuccess(res, result, 'Subscription plan archived successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const planController = new PlanController();
export default planController;

