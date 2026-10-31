import { authService } from './auth.service.js';
import { sendSuccess } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';

export class AuthController {
  /**
   * Requirement 4: Allow public customer registration.
   */
  async registerCustomer(req, res, next) {
    try {
      const result = await authService.registerCustomer(req.body);
      return sendSuccess(res, result, 'Customer account registered successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Requirement 5: Only admin can create staff accounts.
   */
  async createStaff(req, res, next) {
    try {
      const result = await authService.createStaffAccount(req.body, req.user);
      return sendSuccess(res, result, 'Staff account created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Requirement 2: Return authenticated application user and role from SQLite.
   */
  async getCurrentUser(req, res, next) {
    try {
      return sendSuccess(
        res,
        {
          user: req.user,
          firebaseClaims: {
            uid: req.firebaseUser.uid,
            email: req.firebaseUser.email
          }
        },
        'User profile retrieved successfully',
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Requirement 11: Implement password reset through Firebase Authentication.
   */
  async requestPasswordReset(req, res, next) {
    try {
      const result = await authService.requestPasswordReset(req.body.email);
      return sendSuccess(res, result, 'Password reset link generated successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Requirement 10: Ensure customers can access only their own records.
   * Admin and Staff can access any record; customers only their own.
   */
  async getUserRecord(req, res, next) {
    try {
      const user = await authService.getUserById(req.params.id);
      if (!user) {
        throw ApiError.notFound(`User with id '${req.params.id}' was not found`);
      }
      return sendSuccess(res, user, 'User record retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
export default authController;

