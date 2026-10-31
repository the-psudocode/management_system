import crypto from 'node:crypto';
import { query, withTransaction } from '../../database/index.js';
import { ApiError } from '../../utils/ApiError.js';
import auth from '../../config/firebase.js';

export class AuthService {
  /**
   * Requirement 6 & 8: Validate email uniqueness in PostgreSQL using parameterized query.
   */
  async checkEmailAvailability(email) {
    const normalizedEmail = email.toLowerCase().trim();
    const result = await query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [normalizedEmail]
    );
    return result.rows.length === 0;
  }

  /**
   * Requirement 4: Allow public customer registration.
   * Requirement 6: Validate email uniqueness.
   * Requirement 7: Execute database transactions with BEGIN, COMMIT and ROLLBACK.
   * Requirement 8: Parameterized SQL queries.
   * Requirement 9: Never trust roles supplied by frontend requests (hardcoded 'customer').
   */
  async registerCustomer({ email, password, name, phone = null, companyName = null, billingAddress = null }) {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Verify email uniqueness in PostgreSQL first
    const isAvailable = await this.checkEmailAvailability(normalizedEmail);
    if (!isAvailable) {
      throw ApiError.conflict('An account with this email address already exists in the system');
    }

    // 2. Create user in Firebase Authentication
    let firebaseUser;
    try {
      firebaseUser = await auth.createUser({
        email: normalizedEmail,
        password,
        displayName: name
      });
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        throw ApiError.conflict('An account with this email already exists in Firebase Authentication');
      }
      throw ApiError.badRequest(`Firebase authentication error: ${err.message}`);
    }

    // 3. Atomically persist user and customer record in PostgreSQL using BEGIN, COMMIT, ROLLBACK
    const userId = crypto.randomUUID();
    const customerId = crypto.randomUUID();

    try {
      await withTransaction(async (client) => {
        // Enforce role strictly to 'customer'
        await client.query(
          `INSERT INTO users (id, firebase_uid, email, name, role, status)
           VALUES ($1, $2, $3, $4, 'customer', 'active')`,
          [userId, firebaseUser.uid, normalizedEmail, name]
        );

        // Requirement 5 & 6: Customer record with foreign key constraint and monetary balance in paise
        await client.query(
          `INSERT INTO customers (id, user_id, company_name, phone, billing_address, account_balance_paise, credit_limit_paise)
           VALUES ($1, $2, $3, $4, $5, 0, 0)`,
          [customerId, userId, companyName, phone, billingAddress]
        );
      });
    } catch (dbError) {
      // Rollback Firebase user if database transaction failed
      try {
        await auth.deleteUser(firebaseUser.uid);
      } catch (cleanupErr) {
        console.error('[AuthService] Failed to rollback Firebase user after DB failure:', cleanupErr.message);
      }
      throw dbError;
    }

    return {
      id: userId,
      firebaseUid: firebaseUser.uid,
      email: normalizedEmail,
      name,
      role: 'customer',
      status: 'active',
      customer: {
        id: customerId,
        companyName,
        phone,
        billingAddress,
        accountBalancePaise: 0,
        creditLimitPaise: 0
      }
    };
  }

  /**
   * Requirement 5: Only admin can create staff accounts.
   * Requirement 8: Parameterized SQL queries.
   */
  async createStaffAccount({ email, password, name, role = 'staff' }, requestingUser) {
    if (!requestingUser || requestingUser.role !== 'admin') {
      throw ApiError.forbidden('Only administrators are authorized to create staff accounts');
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!['staff', 'admin'].includes(role)) {
      throw ApiError.badRequest('Invalid staff role. Must be either "staff" or "admin"');
    }

    const isAvailable = await this.checkEmailAvailability(normalizedEmail);
    if (!isAvailable) {
      throw ApiError.conflict('An account with this email address already exists in the system');
    }

    let firebaseUser;
    try {
      firebaseUser = await auth.createUser({
        email: normalizedEmail,
        password,
        displayName: name
      });
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        throw ApiError.conflict('An account with this email already exists in Firebase Authentication');
      }
      throw ApiError.badRequest(`Firebase authentication error: ${err.message}`);
    }

    const userId = crypto.randomUUID();

    try {
      await query(
        `INSERT INTO users (id, firebase_uid, email, name, role, status)
         VALUES ($1, $2, $3, $4, $5, 'active')`,
        [userId, firebaseUser.uid, normalizedEmail, name, role]
      );
    } catch (dbError) {
      try {
        await auth.deleteUser(firebaseUser.uid);
      } catch (cleanupErr) {
        console.error('[AuthService] Failed to rollback Firebase staff after DB failure:', cleanupErr.message);
      }
      throw dbError;
    }

    return {
      id: userId,
      firebaseUid: firebaseUser.uid,
      email: normalizedEmail,
      name,
      role,
      status: 'active'
    };
  }

  /**
   * Requirement 2 & 8: Retrieve user and role from PostgreSQL using parameterized query.
   */
  async getUserByFirebaseUid(firebaseUid) {
    const result = await query(
      `SELECT 
        u.id, 
        u.firebase_uid, 
        u.email, 
        u.name, 
        u.role, 
        u.status, 
        u.created_at, 
        u.updated_at,
        c.id AS customer_id,
        c.company_name,
        c.phone,
        c.billing_address,
        c.account_balance_paise,
        c.credit_limit_paise
      FROM users u
      LEFT JOIN customers c ON c.user_id = u.id
      WHERE u.firebase_uid = $1`,
      [firebaseUid]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      firebaseUid: row.firebase_uid,
      email: row.email,
      name: row.name,
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      customer: row.customer_id
        ? {
          id: row.customer_id,
          companyName: row.company_name,
          phone: row.phone,
          billingAddress: row.billing_address,
          accountBalancePaise: row.account_balance_paise ? Number(row.account_balance_paise) : 0,
          creditLimitPaise: row.credit_limit_paise ? Number(row.credit_limit_paise) : 0
        }
        : null
    };
  }

  /**
   * Retrieve user record by internal user ID using parameterized query.
   */
  async getUserById(id) {
    const result = await query(
      `SELECT 
        u.id, 
        u.firebase_uid, 
        u.email, 
        u.name, 
        u.role, 
        u.status, 
        u.created_at, 
        u.updated_at,
        c.id AS customer_id,
        c.company_name,
        c.phone,
        c.billing_address,
        c.account_balance_paise,
        c.credit_limit_paise
      FROM users u
      LEFT JOIN customers c ON c.user_id = u.id
      WHERE u.id = $1`,
      [id]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      firebaseUid: row.firebase_uid,
      email: row.email,
      name: row.name,
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      customer: row.customer_id
        ? {
          id: row.customer_id,
          companyName: row.company_name,
          phone: row.phone,
          billingAddress: row.billing_address,
          accountBalancePaise: row.account_balance_paise ? Number(row.account_balance_paise) : 0,
          creditLimitPaise: row.credit_limit_paise ? Number(row.credit_limit_paise) : 0
        }
        : null
    };
  }

  /**
   * Requirement 11 & 8: Password reset through Firebase Authentication using parameterized query.
   */
  async requestPasswordReset(email) {
    const normalizedEmail = email.toLowerCase().trim();

    const result = await query(
      'SELECT id, email, name FROM users WHERE LOWER(email) = LOWER($1)',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('No account found associated with this email address');
    }

    let resetLink;
    try {
      resetLink = await auth.generatePasswordResetLink(normalizedEmail);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        throw ApiError.notFound('No account found associated with this email address in Firebase');
      }
      throw ApiError.badRequest(`Firebase password reset error: ${err.message}`);
    }

    return {
      email: normalizedEmail,
      message: 'Password reset link successfully generated via Firebase Authentication',
      resetLink
    };
  }

  /**
   * Helper to seed initial administrator in PostgreSQL if one doesn't exist.
   */
  async seedAdminIfNotExists({ email, password, name = 'Brightloop Administrator' }) {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [normalizedEmail]
    );

    if (existing.rows.length > 0) {
      return this.getUserById(existing.rows[0].id);
    }

    let firebaseUid;
    try {
      const fbUser = await auth.createUser({
        email: normalizedEmail,
        password,
        displayName: name
      });
      firebaseUid = fbUser.uid;
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        const existingFb = await auth.getUserByEmail(normalizedEmail);
        firebaseUid = existingFb.uid;
      } else {
        throw err;
      }
    }

    const userId = crypto.randomUUID();
    await query(
      `INSERT INTO users (id, firebase_uid, email, name, role, status)
       VALUES ($1, $2, $3, $4, 'admin', 'active')`,
      [userId, firebaseUid, normalizedEmail, name]
    );

    return this.getUserById(userId);
  }
}

export const authService = new AuthService();
export default authService;
