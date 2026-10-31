import auth from '../config/firebase.js';
import { authService } from '../modules/auth/auth.service.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Requirement 1: Implement Firebase ID token verification middleware.
 * Requirement 2: After token verification, retrieve the application user and role from SQLite.
 * Requirement 9: Never trust roles supplied by frontend requests (always read role from SQLite).
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Authentication token is missing. Please provide a Bearer token in Authorization header.');
    }

    const idToken = authHeader.split('Bearer ')[1].trim();

    if (!idToken) {
      throw ApiError.unauthorized('Authentication token cannot be empty.');
    }

    // 1. Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (firebaseErr) {
      const code = firebaseErr.code || 'auth/invalid-token';
      if (code === 'auth/id-token-expired') {
        throw ApiError.unauthorized('Authentication token has expired. Please refresh your session.');
      }
      if (code === 'auth/id-token-revoked') {
        throw ApiError.unauthorized('Authentication token has been revoked. Please sign in again.');
      }
      throw ApiError.unauthorized('Invalid authentication token.', firebaseErr.message);
    }

    // 2. Retrieve user and verified role from PostgreSQL (never frontend)
    const applicationUser = await authService.getUserByFirebaseUid(decodedToken.uid);

    if (!applicationUser) {
      throw ApiError.unauthorized('Account exists in Firebase but is not registered in the Brightloop Billing system.');
    }

    if (applicationUser.status !== 'active') {
      throw ApiError.forbidden(`Your account status is ${applicationUser.status}. Access is restricted.`);
    }

    // Attach verified user and token payload to request
    req.user = applicationUser;
    req.firebaseUser = decodedToken;

    next();
  } catch (error) {
    next(error);
  }
};

export default authenticate;

