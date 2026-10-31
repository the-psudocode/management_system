import { Router } from 'express';
import { planController } from './plan.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  listPlansQuerySchema,
  planIdParamSchema,
  createPlanSchema,
  updatePlanSchema,
  updatePlanStatusSchema
} from './plan.validation.js';

export const createPlanRouter = () => {
  const router = Router();

  // All plan endpoints require authentication and admin/staff privileges
  router.use(authenticate);
  router.use(authorizeRoles('admin', 'staff'));

  /**
   * @route   GET /api/plans
   * @desc    List subscription plans with pagination, search, and filters
   * @access  Protected (Admin and Staff only)
   */
  router.get(
    '/',
    validate(listPlansQuerySchema, 'query'),
    planController.listPlans
  );

  /**
   * @route   POST /api/plans
   * @desc    Create a new subscription plan
   * @access  Protected (Admin and Staff only)
   */
  router.post(
    '/',
    validate(createPlanSchema, 'body'),
    planController.createPlan
  );

  /**
   * @route   GET /api/plans/:id
   * @desc    Retrieve plan details by ID
   * @access  Protected (Admin and Staff only)
   */
  router.get(
    '/:id',
    validate(planIdParamSchema, 'params'),
    planController.getPlan
  );

  /**
   * @route   PUT /api/plans/:id
   * @desc    Update subscription plan details
   * @access  Protected (Admin and Staff only)
   */
  router.put(
    '/:id',
    validate(planIdParamSchema, 'params'),
    validate(updatePlanSchema, 'body'),
    planController.updatePlan
  );

  /**
   * @route   PATCH /api/plans/:id/status
   * @desc    Update subscription plan status ('active', 'inactive', 'archived')
   * @access  Protected (Admin and Staff only)
   */
  router.patch(
    '/:id/status',
    validate(planIdParamSchema, 'params'),
    validate(updatePlanStatusSchema, 'body'),
    planController.updateStatus
  );

  /**
   * @route   DELETE /api/plans/:id
   * @desc    Safely archive a subscription plan
   * @access  Protected (Admin and Staff only)
   */
  router.delete(
    '/:id',
    validate(planIdParamSchema, 'params'),
    planController.deletePlan
  );

  return router;
};

export const planRouter = createPlanRouter();
export default planRouter;

