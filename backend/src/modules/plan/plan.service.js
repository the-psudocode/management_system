import crypto from 'node:crypto';
import { query } from '../../database/index.js';
import { ApiError } from '../../utils/ApiError.js';

export class PlanService {
  /**
   * Helper to format raw plan row into standardized response shape
   * including frontend-compatible field aliases (productName, priceInPaise, isActive, etc.)
   */
  formatPlan(row) {
    if (!row) return null;
    const amount = Number(row.amount_paise || 0);
    const isActive = row.status === 'active';

    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      productId: row.product_id,
      product_id: row.product_id,
      productName: row.product_name || '',
      product: row.product_name
        ? {
          id: row.product_id,
          name: row.product_name,
          type: row.product_type || 'service',
          status: row.product_status || 'active'
        }
        : undefined,
      amountPaise: amount,
      amount_paise: amount,
      priceInPaise: amount, // Frontend alias
      billingInterval: row.billing_interval,
      billing_interval: row.billing_interval,
      intervalCount: Number(row.interval_count || 1),
      interval_count: Number(row.interval_count || 1),
      currency: row.currency || 'INR',
      status: row.status,
      isActive, // Frontend alias
      autoClose: Boolean(row.auto_close),
      auto_close: Boolean(row.auto_close),
      minimumQuantity: Number(row.minimum_quantity || 1),
      minimum_quantity: Number(row.minimum_quantity || 1),
      availableFrom: row.available_from,
      available_from: row.available_from,
      availableUntil: row.available_until,
      available_until: row.available_until,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * GET /api/plans - List subscription plans with pagination, search & filters
   */
  async listPlans({
    page = 1,
    limit = 10,
    search = '',
    status = 'all',
    billing_interval = 'all',
    productId,
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = {}) {
    const whereConditions = [];
    const params = [];
    let pIdx = 1;

    // Filter by status
    if (status && status !== 'all') {
      whereConditions.push(`sp.status = $${pIdx}`);
      params.push(status);
      pIdx++;
    }

    // Filter by billing interval
    if (billing_interval && billing_interval !== 'all') {
      whereConditions.push(`sp.billing_interval = $${pIdx}`);
      params.push(billing_interval);
      pIdx++;
    }

    // Filter by product ID
    if (productId && productId.trim() !== '') {
      whereConditions.push(`sp.product_id = $${pIdx}`);
      params.push(productId.trim());
      pIdx++;
    }

    // Search filter on plan name, description or product name
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      whereConditions.push(
        `(sp.name ILIKE $${pIdx} OR sp.description ILIKE $${pIdx} OR p.name ILIKE $${pIdx})`
      );
      params.push(searchTerm);
      pIdx++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Total count query
    const countSql = `
      SELECT COUNT(*) AS total
      FROM subscription_plans sp
      LEFT JOIN products p ON p.id = sp.product_id
      ${whereClause}
    `;
    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Sorting column validation
    const allowedSort = {
      created_at: 'sp.created_at',
      name: 'sp.name',
      amount_paise: 'sp.amount_paise',
      billing_interval: 'sp.billing_interval'
    };
    const sortColumn = allowedSort[sortBy] || 'sp.created_at';
    const direction = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Pagination query
    const offset = (page - 1) * limit;
    const paginationParams = [...params, limit, offset];
    const dataSql = `
      SELECT
        sp.id, sp.product_id, sp.name, sp.billing_interval, sp.interval_count,
        sp.amount_paise, sp.currency, sp.status, sp.auto_close, sp.available_from,
        sp.available_until, sp.description, sp.minimum_quantity, sp.created_at, sp.updated_at,
        p.name AS product_name, p.type AS product_type, p.status AS product_status
      FROM subscription_plans sp
      LEFT JOIN products p ON p.id = sp.product_id
      ${whereClause}
      ORDER BY ${sortColumn} ${direction}
      LIMIT $${pIdx} OFFSET $${pIdx + 1}
    `;

    const dataResult = await query(dataSql, paginationParams);
    const data = dataResult.rows.map((row) => this.formatPlan(row));
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
   * GET /api/plans/:id - Retrieve single plan by ID
   */
  async getPlanById(planId) {
    const sql = `
      SELECT
        sp.id, sp.product_id, sp.name, sp.billing_interval, sp.interval_count,
        sp.amount_paise, sp.currency, sp.status, sp.auto_close, sp.available_from,
        sp.available_until, sp.description, sp.minimum_quantity, sp.created_at, sp.updated_at,
        p.name AS product_name, p.type AS product_type, p.status AS product_status
      FROM subscription_plans sp
      LEFT JOIN products p ON p.id = sp.product_id
      WHERE sp.id = $1
    `;
    const result = await query(sql, [planId]);
    if (result.rows.length === 0) {
      return null;
    }
    return this.formatPlan(result.rows[0]);
  }

  /**
   * POST /api/plans - Create a new subscription plan
   */
  async createPlan({
    name,
    productId,
    billingInterval,
    intervalCount = 1,
    amountPaise,
    currency = 'INR',
    status = 'active',
    description = null,
    minimumQuantity = 1,
    autoClose = false,
    availableFrom = null,
    availableUntil = null
  }) {
    // 1. Verify associated product exists in products table
    const productCheck = await query('SELECT id, status FROM products WHERE id = $1', [productId]);
    if (productCheck.rows.length === 0) {
      throw ApiError.notFound(`Associated product with ID '${productId}' does not exist`);
    }

    const planId = crypto.randomUUID();

    const insertSql = `
      INSERT INTO subscription_plans (
        id, product_id, name, billing_interval, interval_count,
        amount_paise, currency, status, description, minimum_quantity,
        auto_close, available_from, available_until, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, NOW(), NOW()
      )
    `;

    await query(insertSql, [
      planId,
      productId,
      name.trim(),
      billingInterval,
      intervalCount,
      amountPaise,
      currency,
      status,
      description,
      minimumQuantity,
      autoClose,
      availableFrom,
      availableUntil
    ]);

    return this.getPlanById(planId);
  }

  /**
   * PUT /api/plans/:id - Update plan details
   */
  async updatePlan(planId, data) {
    const existing = await this.getPlanById(planId);
    if (!existing) {
      throw ApiError.notFound(`Subscription plan with ID '${planId}' not found`);
    }

    // If productId is being updated, verify target product exists
    if (data.productId && data.productId !== existing.productId) {
      const productCheck = await query('SELECT id FROM products WHERE id = $1', [data.productId]);
      if (productCheck.rows.length === 0) {
        throw ApiError.notFound(`Associated product with ID '${data.productId}' does not exist`);
      }
    }

    const updates = [];
    const params = [];
    let pIdx = 1;

    const fieldMap = {
      name: 'name',
      productId: 'product_id',
      billingInterval: 'billing_interval',
      intervalCount: 'interval_count',
      amountPaise: 'amount_paise',
      currency: 'currency',
      status: 'status',
      description: 'description',
      minimumQuantity: 'minimum_quantity',
      autoClose: 'auto_close',
      availableFrom: 'available_from',
      availableUntil: 'available_until'
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        updates.push(`${col} = $${pIdx}`);
        params.push(data[key]);
        pIdx++;
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      params.push(planId);
      const updateSql = `UPDATE subscription_plans SET ${updates.join(', ')} WHERE id = $${pIdx}`;
      await query(updateSql, params);
    }

    return this.getPlanById(planId);
  }

  /**
   * PATCH /api/plans/:id/status - Update plan status ('active', 'inactive', 'archived')
   */
  async updatePlanStatus(planId, status) {
    const existing = await this.getPlanById(planId);
    if (!existing) {
      throw ApiError.notFound(`Subscription plan with ID '${planId}' not found`);
    }

    await query(
      'UPDATE subscription_plans SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, planId]
    );

    return this.getPlanById(planId);
  }

  /**
   * DELETE /api/plans/:id - Safe archival of plan (status = 'archived')
   */
  async deletePlan(planId) {
    const existing = await this.getPlanById(planId);
    if (!existing) {
      throw ApiError.notFound(`Subscription plan with ID '${planId}' not found`);
    }

    // Safe archival: Mark as archived to preserve relational integrity with subscriptions and quotation items
    await query(
      "UPDATE subscription_plans SET status = 'archived', updated_at = NOW() WHERE id = $1",
      [planId]
    );

    return {
      id: planId,
      status: 'archived',
      archived: true,
      message: 'Subscription plan archived successfully'
    };
  }
}

export const planService = new PlanService();
export default planService;

