import crypto from 'node:crypto';
import { query, withTransaction } from '../../database/index.js';
import { ApiError } from '../../utils/ApiError.js';

export class PaymentService {
  /**
   * Helper to format payment row + its allocations into standard response shape
   */
  formatPayment(row, allocations = []) {
    if (!row) return null;
    const amount = Number(row.amount_paise || 0);

    return {
      id: row.id,
      customerId: row.customer_id,
      customer_id: row.customer_id,
      customer: row.customer_name
        ? {
          id: row.customer_id,
          name: row.customer_name,
          email: row.customer_email,
          company: row.company_name,
          companyName: row.company_name,
          phone: row.phone
        }
        : undefined,
      method: row.method,
      amountPaise: amount,
      amount_paise: amount,
      amountInPaise: amount, // Frontend alias
      currency: row.currency || 'INR',
      reference: row.reference || '',
      receivedAt: row.received_at,
      received_at: row.received_at,
      date: row.received_at, // Frontend alias
      notes: row.notes || '',
      allocations: allocations.map((a) => ({
        invoiceId: a.invoice_id,
        invoice_id: a.invoice_id,
        invoiceNumber: a.invoice_number,
        amountPaise: Number(a.amount_paise || 0),
        amount_paise: Number(a.amount_paise || 0),
        createdAt: a.created_at
      })),
      createdAt: row.created_at
    };
  }

  /**
   * GET /api/payments - List payments with pagination, search, and filters
   */
  async listPayments({
    page = 1,
    limit = 10,
    search = '',
    method = 'all',
    customerId,
    invoiceId,
    startDate,
    endDate,
    sortBy = 'received_at',
    sortOrder = 'desc'
  } = {}) {
    const whereConditions = [];
    const params = [];
    let pIdx = 1;

    // Filter by customer ID
    if (customerId && customerId.trim() !== '') {
      whereConditions.push(`p.customer_id = $${pIdx}`);
      params.push(customerId.trim());
      pIdx++;
    }

    // Filter by payment method
    if (method && method !== 'all') {
      whereConditions.push(`p.method = $${pIdx}`);
      params.push(method);
      pIdx++;
    }

    // Filter by date range
    if (startDate) {
      whereConditions.push(`p.received_at >= $${pIdx}`);
      params.push(startDate);
      pIdx++;
    }
    if (endDate) {
      whereConditions.push(`p.received_at <= $${pIdx}`);
      params.push(endDate);
      pIdx++;
    }

    // Filter by invoice allocation
    if (invoiceId && invoiceId.trim() !== '') {
      whereConditions.push(`EXISTS (SELECT 1 FROM payment_allocations pa WHERE pa.payment_id = p.id AND pa.invoice_id = $${pIdx})`);
      params.push(invoiceId.trim());
      pIdx++;
    }

    // Search filter on reference, notes, customer name, company, email
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      whereConditions.push(
        `(p.reference ILIKE $${pIdx} OR p.notes ILIKE $${pIdx} OR u.name ILIKE $${pIdx} OR c.company_name ILIKE $${pIdx} OR u.email ILIKE $${pIdx})`
      );
      params.push(searchTerm);
      pIdx++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Total count query
    const countSql = `
      SELECT COUNT(*) AS total
      FROM payments p
      JOIN customers c ON c.id = p.customer_id
      JOIN users u ON u.id = c.user_id
      ${whereClause}
    `;
    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Sorting column validation
    const allowedSort = {
      created_at: 'p.created_at',
      received_at: 'p.received_at',
      amount_paise: 'p.amount_paise'
    };
    const sortColumn = allowedSort[sortBy] || 'p.received_at';
    const direction = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Pagination query
    const offset = (page - 1) * limit;
    const paginationParams = [...params, limit, offset];
    const dataSql = `
      SELECT
        p.id, p.customer_id, p.method, p.amount_paise, p.currency,
        p.reference, p.received_at, p.notes, p.created_at,
        u.name AS customer_name, u.email AS customer_email, c.company_name, c.phone
      FROM payments p
      JOIN customers c ON c.id = p.customer_id
      JOIN users u ON u.id = c.user_id
      ${whereClause}
      ORDER BY ${sortColumn} ${direction}
      LIMIT $${pIdx} OFFSET $${pIdx + 1}
    `;

    const dataResult = await query(dataSql, paginationParams);
    const payments = dataResult.rows;

    // Batch fetch allocations for returned payments
    let allocationsByPaymentId = new Map();
    if (payments.length > 0) {
      const paymentIds = payments.map((pm) => pm.id);
      const allocSql = `
        SELECT pa.payment_id, pa.invoice_id, pa.amount_paise, pa.created_at, inv.number AS invoice_number
        FROM payment_allocations pa
        JOIN invoices inv ON inv.id = pa.invoice_id
        WHERE pa.payment_id = ANY($1)
      `;
      const allocResult = await query(allocSql, [paymentIds]);
      for (const a of allocResult.rows) {
        if (!allocationsByPaymentId.has(a.payment_id)) {
          allocationsByPaymentId.set(a.payment_id, []);
        }
        allocationsByPaymentId.get(a.payment_id).push(a);
      }
    }

    const data = payments.map((pm) =>
      this.formatPayment(pm, allocationsByPaymentId.get(pm.id) || [])
    );
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
   * GET /api/payments/:id - Retrieve single payment details by ID
   */
  async getPaymentById(paymentId) {
    const paymentSql = `
      SELECT
        p.id, p.customer_id, p.method, p.amount_paise, p.currency,
        p.reference, p.received_at, p.notes, p.created_at,
        u.name AS customer_name, u.email AS customer_email, c.company_name, c.phone
      FROM payments p
      JOIN customers c ON c.id = p.customer_id
      JOIN users u ON u.id = c.user_id
      WHERE p.id = $1
    `;
    const paymentResult = await query(paymentSql, [paymentId]);
    if (paymentResult.rows.length === 0) {
      return null;
    }

    const allocSql = `
      SELECT pa.payment_id, pa.invoice_id, pa.amount_paise, pa.created_at, inv.number AS invoice_number
      FROM payment_allocations pa
      JOIN invoices inv ON inv.id = pa.invoice_id
      WHERE pa.payment_id = $1
    `;
    const allocResult = await query(allocSql, [paymentId]);

    return this.formatPayment(paymentResult.rows[0], allocResult.rows);
  }

  /**
   * POST /api/payments - Record a payment transaction
   */
  async createPayment({
    customerId,
    amountPaise,
    method,
    currency = 'INR',
    reference = null,
    receivedAt = null,
    notes = null,
    invoiceId = null
  }) {
    // 1. Verify customer exists
    const customerCheck = await query('SELECT id FROM customers WHERE id = $1', [customerId]);
    if (customerCheck.rows.length === 0) {
      throw ApiError.notFound(`Customer with ID '${customerId}' not found`);
    }

    // 2. If reference provided, check for duplicate reference
    if (reference && reference.trim() !== '') {
      const refCheck = await query(
        'SELECT id FROM payments WHERE LOWER(reference) = LOWER($1) AND customer_id = $2',
        [reference.trim(), customerId]
      );
      if (refCheck.rows.length > 0) {
        throw ApiError.conflict(`Payment with transaction reference '${reference}' already exists for this customer`);
      }
    }

    // 3. If invoiceId provided, verify invoice exists and belongs to customer
    if (invoiceId) {
      const invoiceCheck = await query(
        'SELECT id, customer_id, total_paise, amount_paid_paise, status FROM invoices WHERE id = $1',
        [invoiceId]
      );
      if (invoiceCheck.rows.length === 0) {
        throw ApiError.notFound(`Invoice with ID '${invoiceId}' not found`);
      }
      if (invoiceCheck.rows[0].customer_id !== customerId) {
        throw ApiError.badRequest(`Invoice '${invoiceId}' does not belong to customer '${customerId}'`);
      }
    }

    const paymentId = crypto.randomUUID();
    const paymentReceivedAt = receivedAt || new Date().toISOString();

    await withTransaction(async (client) => {
      // Insert payment record
      await client.query(
        `INSERT INTO payments (
           id, customer_id, method, amount_paise, currency,
           reference, received_at, notes, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          paymentId,
          customerId,
          method,
          amountPaise,
          currency,
          reference ? reference.trim() : null,
          paymentReceivedAt,
          notes
        ]
      );

      // If allocated to an invoice, record allocation and update invoice status
      if (invoiceId) {
        await client.query(
          `INSERT INTO payment_allocations (
             payment_id, invoice_id, amount_paise, created_at
           ) VALUES ($1, $2, $3, NOW())`,
          [paymentId, invoiceId, amountPaise]
        );

        // Fetch and update invoice amount_paid_paise
        const invRes = await client.query(
          'SELECT total_paise, amount_paid_paise FROM invoices WHERE id = $1 FOR UPDATE',
          [invoiceId]
        );
        const inv = invRes.rows[0];
        const newPaid = BigInt(inv.amount_paid_paise || 0) + BigInt(amountPaise);
        const total = BigInt(inv.total_paise || 0);

        let newStatus = 'partially_paid';
        if (newPaid >= total) {
          newStatus = 'paid';
        }

        await client.query(
          `UPDATE invoices
           SET amount_paid_paise = $1, status = $2, updated_at = NOW()
           WHERE id = $3`,
          [newPaid.toString(), newStatus, invoiceId]
        );
      }
    });

    return this.getPaymentById(paymentId);
  }

  /**
   * GET /api/payments/stats - Summary statistics of payments
   */
  async getPaymentStats(customerId = null) {
    let whereClause = '';
    const params = [];
    if (customerId) {
      whereClause = 'WHERE customer_id = $1';
      params.push(customerId);
    }

    const statsSql = `
      SELECT
        COUNT(*) AS total_count,
        COALESCE(SUM(amount_paise), 0) AS total_amount_paise,
        method,
        COUNT(*) AS method_count
      FROM payments
      ${whereClause}
      GROUP BY method
    `;

    const result = await query(statsSql, params);
    let totalCount = 0;
    let totalAmountPaise = 0n;
    const methodBreakdown = {};

    for (const row of result.rows) {
      const count = parseInt(row.method_count, 10);
      const amount = BigInt(row.total_amount_paise || 0);
      totalCount += count;
      totalAmountPaise += amount;
      methodBreakdown[row.method] = { count, amountPaise: Number(amount) };
    }

    return {
      totalCount,
      totalAmountPaise: Number(totalAmountPaise),
      totalRevenueInPaise: Number(totalAmountPaise), // Frontend alias
      byMethod: methodBreakdown
    };
  }
}

export const paymentService = new PaymentService();
export default paymentService;

