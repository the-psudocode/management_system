import { ApiError } from '../utils/ApiError.js';

// A verified authentication middleware must set req.user before these guards run.
export const requireAuth = (req, res, next) => {
  if (!req.user?.id || !req.user?.role) {
    return next(ApiError.unauthorized('Authentication is required.'));
  }
  return next();
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user?.id || !req.user?.role) {
    return next(ApiError.unauthorized('Authentication is required.'));
  }
  if (!roles.includes(String(req.user.role).toLowerCase())) {
    return next(ApiError.forbidden('You do not have permission to perform this action.'));
  }
  return next();
};
