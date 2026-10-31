import { ApiError } from '../utils/ApiError.js';

/**
 * Requirement 8: Implement role-based authorization middleware.
 * Requirement 3: Support admin, staff and customer roles.
 * Requirement 9: Never trust roles supplied by frontend requests (uses req.user from SQLite).
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required before role verification'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Access forbidden: Role '${req.user.role}' lacks permission. Required: [${allowedRoles.join(', ')}]`
        )
      );
    }

    next();
  };
};

/**
 * Requirement 10: Ensure customers can access only their own records.
 * Staff and admins can access any record; customers are strictly restricted to their own IDs.
 *
 * @param {Object} options
 * @param {string} [options.paramKey='id'] - The request parameter name representing the user/customer ID
 * @param {string[]} [options.elevatedRoles=['admin', 'staff']] - Roles with system-wide access
 */
export const authorizeSelfOrRoles = ({
  paramKey = 'id',
  elevatedRoles = ['admin', 'staff']
} = {}) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required before authorization'));
    }

    // Admins and Staff have elevated access to view any record
    if (elevatedRoles.includes(req.user.role)) {
      return next();
    }

    // Customers can strictly only access their own user ID or customer ID
    if (req.user.role === 'customer') {
      const targetId = req.params[paramKey] || req.query[paramKey] || req.body[paramKey];

      const isOwnUserId = targetId && targetId === req.user.id;
      const isOwnCustomerId = targetId && req.user.customer && targetId === req.user.customer.id;

      if (isOwnUserId || isOwnCustomerId) {
        return next();
      }

      return next(
        ApiError.forbidden('Access forbidden: Customers are strictly permitted to access only their own records.')
      );
    }

    return next(ApiError.forbidden('Access forbidden: Insufficient permissions.'));
  };
};

export default {
  authorizeRoles,
  authorizeSelfOrRoles
};

