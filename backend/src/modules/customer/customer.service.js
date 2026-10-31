import crypto from 'node:crypto';
import { query, withTransaction } from '../../database/index.js';
import { ApiError } from '../../utils/ApiError.js';
import auth from '../../config/firebase.js';

export class CustomerService {
  /**
   * Helper to format raw database join rows into standard response shapes,
   * including frontend-compatible field aliases (company, address, etc.)
   */
  formatCustomer(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      firebaseUid: row.firebase_uid,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      phone: row.phone || null,
      companyName: row.company_name || null,
      company: row.company_name || null, // Frontend alias
      billingAddress: row.billing_address || null,
      address: row.billing_address || null, // Frontend alias
      city: null, // Frontend compatibility (not currently stored in DB)
      state: null, // Frontend compatibility
      pincode: null, // Frontend compatibility
      gstin: null, // Frontend compatibility
      accountBalancePaise: Number(row.account_balance_paise || 0),
      creditLimitPaise: Number(row.credit_limit_paise || 0),
      account_balance_paise: Number(row.account_balance_paise || 0),
      credit_limit_paise: Number(row.credit_limit_paise || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Check email availability in PostgreSQL users table using parameterized query
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
   * GET /api/customers - List customers with pagination, search, status filtering, and sorting
   * Admin and staff only
   */
  async listCustomers({
    page = 1,
    limit = 10,
    search = '',
    status = 'all',
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = {}) {
    const params = [];
    let paramIndex = 1;
    const whereConditions = [];

    // Filter by user role to ensure only customer accounts are returned
    whereConditions.push(`u.role = 'customer'`);

    // Status filter
    if (status && status !== 'all') {
      whereConditions.push(`u.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    // Search filter across name, email, and company_name
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      whereConditions.push(
        `(u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR c.company_name ILIKE $${paramIndex})`
      );
      params.push(searchTerm);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count total matching records
    const countSql = `
      SELECT COUNT(*) AS total
      FROM customers c
      JOIN users u ON u.id = c.user_id
      ${whereClause}
    `;
    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Sorting column mapping to prevent SQL injection
    const allowedSortColumns = {
      created_at: 'c.created_at',
      name: 'u.name',
      email: 'u.email',
      company_name: 'c.company_name'
    };
    const sortColumn = allowedSortColumns[sortBy] || 'c.created_at';
    const direction = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Pagination calculations
    const offset = (page - 1) * limit;
    const paginationParams = [...params, limit, offset];
    const dataSql = `
      SELECT 
        c.id, 
        c.user_id, 
        c.company_name, 
        c.phone, 
        c.billing_address,
        c.account_balance_paise, 
        c.credit_limit_paise, 
        c.created_at, 
        c.updated_at,
        u.firebase_uid, 
        u.email, 
        u.name, 
        u.role, 
        u.status
      FROM customers c
      JOIN users u ON u.id = c.user_id
      ${whereClause}
      ORDER BY ${sortColumn} ${direction}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataResult = await query(dataSql, paginationParams);
    const data = dataResult.rows.map((row) => this.formatCustomer(row));
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      pagination: {
        total,
        page,
        pageSize: limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  /**
   * GET /api/customers/:id - Retrieve single customer by customer ID
   */
  async getCustomerById(customerId) {
    const sql = `
      SELECT 
        c.id, 
        c.user_id, 
        c.company_name, 
        c.phone, 
        c.billing_address,
        c.account_balance_paise, 
        c.credit_limit_paise, 
        c.created_at, 
        c.updated_at,
        u.firebase_uid, 
        u.email, 
        u.name, 
        u.role, 
        u.status
      FROM customers c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = $1
    `;

    const result = await query(sql, [customerId]);
    if (result.rows.length === 0) {
      return null;
    }

    return this.formatCustomer(result.rows[0]);
  }

  /**
   * POST /api/customers - Create a new customer profile (Admin and Staff)
   * Creates Firebase Auth user, PostgreSQL user, and PostgreSQL customer atomically.
   * If database operation fails, rolls back transaction and cleans up Firebase user.
   */
  async createCustomer({
    email,
    password,
    name,
    phone = null,
    companyName = null,
    billingAddress = null,
    creditLimitPaise = 0
  }) {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check email uniqueness in PostgreSQL first
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

    // 3. Persist atomically in PostgreSQL with BEGIN, COMMIT, ROLLBACK
    const userId = crypto.randomUUID();
    const customerId = crypto.randomUUID();

    try {
      await withTransaction(async (client) => {
        // Enforce role strictly as 'customer' server-side
        await client.query(
          `INSERT INTO users (id, firebase_uid, email, name, role, status)
           VALUES ($1, $2, $3, $4, 'customer', 'active')`,
          [userId, firebaseUser.uid, normalizedEmail, name]
        );

        await client.query(
          `INSERT INTO customers (
             id, user_id, company_name, phone, billing_address, account_balance_paise, credit_limit_paise
           ) VALUES ($1, $2, $3, $4, $5, 0, $6)`,
          [customerId, userId, companyName, phone, billingAddress, creditLimitPaise]
        );
      });
    } catch (dbError) {
      // Safe cleanup: delete the newly created Firebase user to prevent orphan auth records
      try {
        await auth.deleteUser(firebaseUser.uid);
      } catch (cleanupErr) {
        console.error('[CustomerService] Failed to rollback Firebase user after database failure:', cleanupErr.message);
      }
      throw dbError;
    }

    return this.getCustomerById(customerId);
  }

  /**
   * PUT /api/customers/:id - Update permitted customer profile fields
   * Admin and staff can update any customer; customers can update only their own profile.
   * Only allows: name, company_name, phone, billing_address.
   */
  async updateCustomer(customerId, { name, companyName, phone, billingAddress }) {
    const existing = await this.getCustomerById(customerId);
    if (!existing) {
      throw ApiError.notFound(`Customer with ID '${customerId}' not found`);
    }

    await withTransaction(async (client) => {
      // Update name on users table if supplied
      if (name !== undefined) {
        await client.query(
          `UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2`,
          [name, existing.userId]
        );
      }

      // Update customers table if customer-specific fields are provided
      const customerUpdates = [];
      const customerParams = [];
      let pIdx = 1;

      if (companyName !== undefined) {
        customerUpdates.push(`company_name = $${pIdx}`);
        customerParams.push(companyName);
        pIdx++;
      }

      if (phone !== undefined) {
        customerUpdates.push(`phone = $${pIdx}`);
        customerParams.push(phone);
        pIdx++;
      }

      if (billingAddress !== undefined) {
        customerUpdates.push(`billing_address = $${pIdx}`);
        customerParams.push(billingAddress);
        pIdx++;
      }

      if (customerUpdates.length > 0) {
        customerUpdates.push(`updated_at = NOW()`);
        customerParams.push(customerId);
        const updateSql = `
          UPDATE customers 
          SET ${customerUpdates.join(', ')} 
          WHERE id = $${pIdx}
        `;
        await client.query(updateSql, customerParams);
      }
    });

    return this.getCustomerById(customerId);
  }

  /**
   * PATCH /api/customers/:id/status - Update account status (Admin only)
   * Allowed: 'active', 'inactive', 'suspended'
   */
  async updateCustomerStatus(customerId, status) {
    const existing = await this.getCustomerById(customerId);
    if (!existing) {
      throw ApiError.notFound(`Customer with ID '${customerId}' not found`);
    }

    await query(
      `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, existing.userId]
    );

    return this.getCustomerById(customerId);
  }

  /**
   * PATCH /api/customers/:id/credit-limit - Update credit limit in paise (Admin only)
   * Must be a non-negative integer.
   */
  async updateCustomerCreditLimit(customerId, creditLimitPaise) {
    const existing = await this.getCustomerById(customerId);
    if (!existing) {
      throw ApiError.notFound(`Customer with ID '${customerId}' not found`);
    }

    await query(
      `UPDATE customers SET credit_limit_paise = $1, updated_at = NOW() WHERE id = $2`,
      [creditLimitPaise, customerId]
    );

    return this.getCustomerById(customerId);
  }

  /**
   * DELETE /api/customers/:id - Safe deactivation/archive policy (Admin only)
   * Sets user status to 'inactive' to prevent breaking foreign keys on subscriptions/invoices.
   */
  async deactivateCustomer(customerId) {
    const existing = await this.getCustomerById(customerId);
    if (!existing) {
      throw ApiError.notFound(`Customer with ID '${customerId}' not found`);
    }

    // Safe deactivation policy: deactivate account instead of hard deleting
    await query(
      `UPDATE users SET status = 'inactive', updated_at = NOW() WHERE id = $1`,
      [existing.userId]
    );

    return {
      id: customerId,
      status: 'inactive',
      deactivated: true,
      message: 'Customer account has been safely deactivated and archived.'
    };
  }
}

export const customerService = new CustomerService();
export default customerService;

