import { query, withTransaction } from '../../database/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { quotationService } from '../quotation/quotation.service.js';
import { paymentService } from '../payment/payment.service.js';
import { planService } from '../plan/plan.service.js';

export class PortalService {
  /**
   * GET /api/portal/profile - Retrieve own customer profile
   */
  async getProfile(customerId) {
    const sql = `
      SELECT
        c.id AS customer_id,
        c.user_id,
        u.email,
        u.name,
        u.role,
        u.status AS user_status,
        c.company_name,
        c.phone,
        c.billing_address,
        c.billing_city,
        c.billing_state_code,
        c.postal_code,
        c.gstin,
        c.account_balance_paise,
        c.credit_limit_paise,
        c.created_at,
        c.updated_at
      FROM customers c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = $1
    `;
    const result = await query(sql, [customerId]);
    if (result.rows.length === 0) {
      throw ApiError.notFound('Customer profile not found');
    }

    const row = result.rows[0];
    return {
      id: row.customer_id,
      userId: row.user_id,
      email: row.email,
      name: row.name,
      role: row.role,
      status: row.user_status,
      company: row.company_name || '',
      companyName: row.company_name || '',
      phone: row.phone || '',
      billingAddress: row.billing_address || '',
      billingCity: row.billing_city || '',
      billingStateCode: row.billing_state_code || '',
      postalCode: row.postal_code || '',
      gstin: row.gstin || '',
      accountBalancePaise: Number(row.account_balance_paise || 0),
      creditLimitPaise: Number(row.credit_limit_paise || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * PUT /api/portal/profile - Update permitted profile fields
   */
  async updateProfile(customerId, data) {
    const profile = await this.getProfile(customerId);

    await withTransaction(async (client) => {
      // 1. Update user name if provided
      if (data.name) {
        await client.query(
          'UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2',
          [data.name.trim(), profile.userId]
        );
      }

      // 2. Update customer fields
      const updates = [];
      const params = [];
      let pIdx = 1;

      const fieldMap = {
        companyName: 'company_name',
        phone: 'phone',
        billingAddress: 'billing_address',
        billingCity: 'billing_city',
        billingStateCode: 'billing_state_code',
        postalCode: 'postal_code',
        gstin: 'gstin'
      };

      for (const [key, col] of Object.entries(fieldMap)) {
        if (data[key] !== undefined) {
          updates.push(`${col} = $${pIdx}`);
          params.push(data[key] ? data[key].trim() : null);
          pIdx++;
        }
      }

      if (updates.length > 0) {
        updates.push('updated_at = NOW()');
        params.push(customerId);
        await client.query(
          `UPDATE customers SET ${updates.join(', ')} WHERE id = $${pIdx}`,
          params
        );
      }
    });

    return this.getProfile(customerId);
  }

  /**
   * GET /api/portal/summary - Dashboard overview for authenticated customer
   */
  async getSummary(customerId) {
    const profile = await this.getProfile(customerId);

    // Active subscriptions count
    const subRes = await query(
      "SELECT COUNT(*) AS active_count FROM subscriptions WHERE customer_id = $1 AND status = 'active'",
      [customerId]
    );
    const activeSubscriptionsCount = parseInt(subRes.rows[0].active_count, 10);

    // Unpaid invoices count and outstanding amount
    const invRes = await query(
      `SELECT
         COUNT(*) AS unpaid_count,
         COALESCE(SUM(total_paise - amount_paid_paise), 0) AS total_outstanding_paise
       FROM invoices
       WHERE customer_id = $1 AND status IN ('confirmed', 'partially_paid', 'overdue')`,
      [customerId]
    );
    const unpaidInvoicesCount = parseInt(invRes.rows[0].unpaid_count, 10);
    const totalOutstandingPaise = Number(invRes.rows[0].total_outstanding_paise || 0);

    // Recent 5 invoices
    const recentInvRes = await query(
      `SELECT id, number, status, currency, total_paise, amount_paid_paise, due_date, created_at
       FROM invoices
       WHERE customer_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [customerId]
    );

    // Recent 5 payments
    const recentPayRes = await query(
      `SELECT id, method, amount_paise, currency, reference, received_at, created_at
       FROM payments
       WHERE customer_id = $1
       ORDER BY received_at DESC
       LIMIT 5`,
      [customerId]
    );

    return {
      customer: {
        id: profile.id,
        name: profile.name,
        company: profile.company,
        email: profile.email
      },
      accountBalancePaise: profile.accountBalancePaise,
      creditLimitPaise: profile.creditLimitPaise,
      activeSubscriptionsCount,
      unpaidInvoicesCount,
      totalOutstandingPaise,
      outstandingInPaise: totalOutstandingPaise, // Frontend alias
      recentInvoices: recentInvRes.rows.map((r) => ({
        id: r.id,
        invoiceNumber: r.number,
        number: r.number,
        status: r.status,
        currency: r.currency,
        totalPaise: Number(r.total_paise || 0),
        amountPaidPaise: Number(r.amount_paid_paise || 0),
        outstandingPaise: Number(r.total_paise || 0) - Number(r.amount_paid_paise || 0),
        dueDate: r.due_date,
        createdAt: r.created_at
      })),
      recentPayments: recentPayRes.rows.map((r) => ({
        id: r.id,
        method: r.method,
        amountPaise: Number(r.amount_paise || 0),
        amountInPaise: Number(r.amount_paise || 0),
        currency: r.currency,
        reference: r.reference || '',
        receivedAt: r.received_at,
        date: r.received_at
      }))
    };
  }

  /**
   * GET /api/portal/subscriptions - List own subscriptions
   */
  async listSubscriptions(customerId, { page = 1, limit = 10, status = 'all' } = {}) {
    const whereConditions = ['s.customer_id = $1'];
    const params = [customerId];
    let pIdx = 2;

    if (status && status !== 'all') {
      whereConditions.push(`s.status = $${pIdx}`);
      params.push(status);
      pIdx++;
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const countRes = await query(`SELECT COUNT(*) AS total FROM subscriptions s ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const offset = (page - 1) * limit;
    const paginationParams = [...params, limit, offset];

    const dataSql = `
      SELECT
        s.id, s.number, s.status, s.billing_interval, s.interval_count,
        s.currency, s.start_date, s.end_date, s.next_billing_date,
        s.auto_renew, s.created_at, s.updated_at
      FROM subscriptions s
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${pIdx} OFFSET $${pIdx + 1}
    `;

    const dataResult = await query(dataSql, paginationParams);
    const subscriptions = dataResult.rows;

    // Fetch line items for each subscription
    let itemsBySubId = new Map();
    if (subscriptions.length > 0) {
      const subIds = subscriptions.map((s) => s.id);
      const itemsSql = `
        SELECT
          si.id, si.subscription_id, si.description, si.quantity,
          si.unit_price_paise, p.name AS product_name, sp.name AS plan_name
        FROM subscription_items si
        JOIN products p ON p.id = si.product_id
        LEFT JOIN subscription_plans sp ON sp.id = si.plan_id
        WHERE si.subscription_id = ANY($1)
      `;
      const itemsRes = await query(itemsSql, [subIds]);
      for (const item of itemsRes.rows) {
        if (!itemsBySubId.has(item.subscription_id)) {
          itemsBySubId.set(item.subscription_id, []);
        }
        itemsBySubId.get(item.subscription_id).push(item);
      }
    }

    const data = subscriptions.map((s) => {
      const items = itemsBySubId.get(s.id) || [];
      const totalAmountPaise = items.reduce(
        (sum, it) => sum + (Number(it.quantity || 1) * Number(it.unit_price_paise || 0)),
        0
      );

      return {
        id: s.id,
        number: s.number,
        status: s.status,
        billingInterval: s.billing_interval,
        intervalCount: s.interval_count,
        currency: s.currency,
        startDate: s.start_date,
        endDate: s.end_date,
        nextBillingDate: s.next_billing_date,
        autoRenew: s.auto_renew,
        amountInPaise: totalAmountPaise,
        items: items.map((it) => ({
          id: it.id,
          description: it.description,
          productName: it.product_name,
          planName: it.plan_name,
          quantity: it.quantity,
          unitPricePaise: Number(it.unit_price_paise || 0)
        })),
        createdAt: s.created_at,
        updatedAt: s.updated_at
      };
    });

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
   * GET /api/portal/subscriptions/:id - View single subscription belonging to customer
   */
  async getSubscriptionById(customerId, subscriptionId) {
    const subRes = await query(
      `SELECT
         s.id, s.number, s.status, s.billing_interval, s.interval_count,
         s.currency, s.start_date, s.end_date, s.next_billing_date,
         s.auto_renew, s.created_at, s.updated_at
       FROM subscriptions s
       WHERE s.id = $1 AND s.customer_id = $2`,
      [subscriptionId, customerId]
    );

    if (subRes.rows.length === 0) {
      throw ApiError.notFound(`Subscription with ID '${subscriptionId}' not found for your account`);
    }

    const sub = subRes.rows[0];
    const itemsRes = await query(
      `SELECT
         si.id, si.description, si.quantity, si.unit_price_paise,
         p.name AS product_name, sp.name AS plan_name
       FROM subscription_items si
       JOIN products p ON p.id = si.product_id
       LEFT JOIN subscription_plans sp ON sp.id = si.plan_id
       WHERE si.subscription_id = $1`,
      [subscriptionId]
    );

    const items = itemsRes.rows;
    const totalAmountPaise = items.reduce(
      (sum, it) => sum + (Number(it.quantity || 1) * Number(it.unit_price_paise || 0)),
      0
    );

    return {
      id: sub.id,
      number: sub.number,
      status: sub.status,
      billingInterval: sub.billing_interval,
      intervalCount: sub.interval_count,
      currency: sub.currency,
      startDate: sub.start_date,
      endDate: sub.end_date,
      nextBillingDate: sub.next_billing_date,
      autoRenew: sub.auto_renew,
      amountInPaise: totalAmountPaise,
      items: items.map((it) => ({
        id: it.id,
        description: it.description,
        productName: it.product_name,
        planName: it.plan_name,
        quantity: it.quantity,
        unitPricePaise: Number(it.unit_price_paise || 0)
      })),
      createdAt: sub.created_at,
      updatedAt: sub.updated_at
    };
  }

  /**
   * GET /api/portal/invoices - List customer's invoices
   */
  async listInvoices(customerId, { page = 1, limit = 10, status = 'all' } = {}) {
    const whereConditions = ['customer_id = $1'];
    const params = [customerId];
    let pIdx = 2;

    if (status && status !== 'all') {
      whereConditions.push(`status = $${pIdx}`);
      params.push(status);
      pIdx++;
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const countRes = await query(`SELECT COUNT(*) AS total FROM invoices ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const offset = (page - 1) * limit;
    const paginationParams = [...params, limit, offset];

    const dataSql = `
      SELECT
        id, number, status, currency, billing_period_start, billing_period_end,
        issued_at, due_date, subtotal_paise, tax_paise, discount_paise, total_paise,
        amount_paid_paise, created_at, updated_at
      FROM invoices
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${pIdx} OFFSET $${pIdx + 1}
    `;

    const dataRes = await query(dataSql, paginationParams);
    const data = dataRes.rows.map((r) => ({
      id: r.id,
      invoiceNumber: r.number,
      number: r.number,
      status: r.status,
      currency: r.currency,
      subtotalPaise: Number(r.subtotal_paise || 0),
      taxPaise: Number(r.tax_paise || 0),
      discountPaise: Number(r.discount_paise || 0),
      totalPaise: Number(r.total_paise || 0),
      totalInPaise: Number(r.total_paise || 0), // Frontend alias
      amountPaidPaise: Number(r.amount_paid_paise || 0),
      outstandingPaise: Number(r.total_paise || 0) - Number(r.amount_paid_paise || 0),
      dueDate: r.due_date,
      billingPeriodStart: r.billing_period_start,
      billingPeriodEnd: r.billing_period_end,
      issuedAt: r.issued_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

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
   * GET /api/portal/invoices/:id - Retrieve single invoice belonging to customer
   */
  async getInvoiceById(customerId, invoiceId) {
    const invRes = await query(
      `SELECT
        id, number, status, currency, billing_period_start, billing_period_end,
        issued_at, due_date, subtotal_paise, tax_paise, discount_paise, total_paise,
        amount_paid_paise, created_at, updated_at
       FROM invoices
       WHERE id = $1 AND customer_id = $2`,
      [invoiceId, customerId]
    );

    if (invRes.rows.length === 0) {
      throw ApiError.notFound(`Invoice with ID '${invoiceId}' not found for your account`);
    }

    const inv = invRes.rows[0];
    const itemsRes = await query(
      `SELECT
         ii.id, ii.description, ii.quantity, ii.unit_price_paise,
         ii.discount_paise, ii.tax_paise, ii.total_paise,
         p.name AS product_name
       FROM invoice_items ii
       LEFT JOIN products p ON p.id = ii.product_id
       WHERE ii.invoice_id = $1`,
      [invoiceId]
    );

    return {
      id: inv.id,
      invoiceNumber: inv.number,
      number: inv.number,
      status: inv.status,
      currency: inv.currency,
      subtotalPaise: Number(inv.subtotal_paise || 0),
      taxPaise: Number(inv.tax_paise || 0),
      discountPaise: Number(inv.discount_paise || 0),
      totalPaise: Number(inv.total_paise || 0),
      totalInPaise: Number(inv.total_paise || 0),
      amountPaidPaise: Number(inv.amount_paid_paise || 0),
      outstandingPaise: Number(inv.total_paise || 0) - Number(inv.amount_paid_paise || 0),
      dueDate: inv.due_date,
      billingPeriodStart: inv.billing_period_start,
      billingPeriodEnd: inv.billing_period_end,
      issuedAt: inv.issued_at,
      lineItems: itemsRes.rows.map((it) => ({
        id: it.id,
        description: it.description,
        productName: it.product_name,
        quantity: it.quantity,
        unitPriceInPaise: Number(it.unit_price_paise || 0),
        discountInPaise: Number(it.discount_paise || 0),
        taxInPaise: Number(it.tax_paise || 0),
        totalInPaise: Number(it.total_paise || 0)
      })),
      createdAt: inv.created_at,
      updatedAt: inv.updated_at
    };
  }

  /**
   * Helper wrappers for quotations, payments, and plans reusing the core services
   */
  async listQuotations(customerId, queryParams) {
    return quotationService.listQuotations({ ...queryParams, customerId });
  }

  async getQuotationById(customerId, quotationId) {
    const q = await quotationService.getQuotationById(quotationId);
    if (!q || q.customerId !== customerId) {
      throw ApiError.notFound(`Quotation with ID '${quotationId}' not found for your account`);
    }
    return q;
  }

  async acceptQuotation(customerId, quotationId) {
    await this.getQuotationById(customerId, quotationId);
    return quotationService.updateQuotationStatus(quotationId, 'accepted', 'customer');
  }

  async declineQuotation(customerId, quotationId) {
    await this.getQuotationById(customerId, quotationId);
    return quotationService.updateQuotationStatus(quotationId, 'declined', 'customer');
  }

  async listPayments(customerId, queryParams) {
    return paymentService.listPayments({ ...queryParams, customerId });
  }

  async getPaymentById(customerId, paymentId) {
    const p = await paymentService.getPaymentById(paymentId);
    if (!p || p.customerId !== customerId) {
      throw ApiError.notFound(`Payment with ID '${paymentId}' not found for your account`);
    }
    return p;
  }

  async listPlans(queryParams) {
    return planService.listPlans({ ...queryParams, status: 'active' });
  }
}

export const portalService = new PortalService();
export default portalService;

