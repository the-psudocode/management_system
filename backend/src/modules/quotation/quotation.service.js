import crypto from 'node:crypto';
import { query, withTransaction } from '../../database/index.js';
import { ApiError } from '../../utils/ApiError.js';

export class QuotationService {
  /**
   * Helper to format quotation row + its items into standard response shape
   */
  formatQuotation(row, items = []) {
    if (!row) return null;
    return {
      id: row.id,
      number: row.number,
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
      templateId: row.template_id,
      status: row.status,
      currency: row.currency || 'INR',
      paymentTerms: row.payment_terms,
      issuedAt: row.issued_at,
      validUntil: row.valid_until,
      subtotalPaise: Number(row.subtotal_paise || 0),
      subtotal_paise: Number(row.subtotal_paise || 0),
      taxPaise: Number(row.tax_paise || 0),
      tax_paise: Number(row.tax_paise || 0),
      discountPaise: Number(row.discount_paise || 0),
      discount_paise: Number(row.discount_paise || 0),
      totalPaise: Number(row.total_paise || 0),
      total_paise: Number(row.total_paise || 0),
      notes: row.notes || '',
      items: items.map((item) => this.formatItem(item)),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Helper to format individual quotation item row
   */
  formatItem(item) {
    if (!item) return null;
    return {
      id: item.id,
      quotationId: item.quotation_id,
      productId: item.product_id,
      product_id: item.product_id,
      productName: item.product_name,
      variantId: item.variant_id,
      variant_id: item.variant_id,
      variantName: item.variant_name,
      planId: item.plan_id,
      plan_id: item.plan_id,
      planName: item.plan_name,
      description: item.description,
      quantity: Number(item.quantity || 1),
      unitPricePaise: Number(item.unit_price_paise || 0),
      unit_price_paise: Number(item.unit_price_paise || 0),
      discountPaise: Number(item.discount_paise || 0),
      discount_paise: Number(item.discount_paise || 0),
      taxPaise: Number(item.tax_paise || 0),
      tax_paise: Number(item.tax_paise || 0),
      totalPaise: Number(item.total_paise || 0),
      total_paise: Number(item.total_paise || 0)
    };
  }

  /**
   * GET /api/quotations - List quotations with pagination, status, and search filters
   */
  async listQuotations({
    page = 1,
    limit = 10,
    search = '',
    status = 'all',
    customerId,
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = {}) {
    const whereConditions = [];
    const params = [];
    let pIdx = 1;

    // Filter by status
    if (status && status !== 'all') {
      whereConditions.push(`q.status = $${pIdx}`);
      params.push(status);
      pIdx++;
    }

    // Filter by customer ID
    if (customerId && customerId.trim() !== '') {
      whereConditions.push(`q.customer_id = $${pIdx}`);
      params.push(customerId.trim());
      pIdx++;
    }

    // Search filter on quotation number, notes, customer name, company, or email
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      whereConditions.push(
        `(q.number ILIKE $${pIdx} OR q.notes ILIKE $${pIdx} OR u.name ILIKE $${pIdx} OR c.company_name ILIKE $${pIdx} OR u.email ILIKE $${pIdx})`
      );
      params.push(searchTerm);
      pIdx++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Total count query
    const countSql = `
      SELECT COUNT(*) AS total
      FROM quotations q
      JOIN customers c ON c.id = q.customer_id
      JOIN users u ON u.id = c.user_id
      ${whereClause}
    `;
    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Sorting column validation
    const allowedSort = {
      created_at: 'q.created_at',
      issued_at: 'q.issued_at',
      valid_until: 'q.valid_until',
      total_paise: 'q.total_paise',
      number: 'q.number'
    };
    const sortColumn = allowedSort[sortBy] || 'q.created_at';
    const direction = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Pagination query
    const offset = (page - 1) * limit;
    const paginationParams = [...params, limit, offset];
    const dataSql = `
      SELECT
        q.id, q.number, q.customer_id, q.template_id, q.status, q.currency,
        q.payment_terms, q.issued_at, q.valid_until, q.subtotal_paise,
        q.tax_paise, q.discount_paise, q.total_paise, q.notes,
        q.created_at, q.updated_at,
        u.name AS customer_name, u.email AS customer_email, c.company_name, c.phone
      FROM quotations q
      JOIN customers c ON c.id = q.customer_id
      JOIN users u ON u.id = c.user_id
      ${whereClause}
      ORDER BY ${sortColumn} ${direction}
      LIMIT $${pIdx} OFFSET $${pIdx + 1}
    `;

    const dataResult = await query(dataSql, paginationParams);
    const quotations = dataResult.rows;

    // Batch fetch items for returned quotations
    let itemsByQuotationId = new Map();
    if (quotations.length > 0) {
      const quotationIds = quotations.map((q) => q.id);
      const itemsSql = `
        SELECT
          qi.id, qi.quotation_id, qi.product_id, qi.variant_id, qi.plan_id,
          qi.description, qi.quantity, qi.unit_price_paise, qi.discount_paise,
          qi.tax_paise, qi.total_paise,
          p.name AS product_name,
          pv.name AS variant_name,
          sp.name AS plan_name
        FROM quotation_items qi
        JOIN products p ON p.id = qi.product_id
        LEFT JOIN product_variants pv ON pv.id = qi.variant_id
        LEFT JOIN subscription_plans sp ON sp.id = qi.plan_id
        WHERE qi.quotation_id = ANY($1)
        ORDER BY qi.id ASC
      `;
      const itemsResult = await query(itemsSql, [quotationIds]);
      for (const item of itemsResult.rows) {
        if (!itemsByQuotationId.has(item.quotation_id)) {
          itemsByQuotationId.set(item.quotation_id, []);
        }
        itemsByQuotationId.get(item.quotation_id).push(item);
      }
    }

    const data = quotations.map((q) =>
      this.formatQuotation(q, itemsByQuotationId.get(q.id) || [])
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
   * GET /api/quotations/:id - Retrieve single quotation by ID
   */
  async getQuotationById(quotationId) {
    const quotationSql = `
      SELECT
        q.id, q.number, q.customer_id, q.template_id, q.status, q.currency,
        q.payment_terms, q.issued_at, q.valid_until, q.subtotal_paise,
        q.tax_paise, q.discount_paise, q.total_paise, q.notes,
        q.created_at, q.updated_at,
        u.name AS customer_name, u.email AS customer_email, c.company_name, c.phone
      FROM quotations q
      JOIN customers c ON c.id = q.customer_id
      JOIN users u ON u.id = c.user_id
      WHERE q.id = $1
    `;
    const quotationResult = await query(quotationSql, [quotationId]);
    if (quotationResult.rows.length === 0) {
      return null;
    }

    const itemsSql = `
      SELECT
        qi.id, qi.quotation_id, qi.product_id, qi.variant_id, qi.plan_id,
        qi.description, qi.quantity, qi.unit_price_paise, qi.discount_paise,
        qi.tax_paise, qi.total_paise,
        p.name AS product_name,
        pv.name AS variant_name,
        sp.name AS plan_name
      FROM quotation_items qi
      JOIN products p ON p.id = qi.product_id
      LEFT JOIN product_variants pv ON pv.id = qi.variant_id
      LEFT JOIN subscription_plans sp ON sp.id = qi.plan_id
      WHERE qi.quotation_id = $1
      ORDER BY qi.id ASC
    `;
    const itemsResult = await query(itemsSql, [quotationId]);

    return this.formatQuotation(quotationResult.rows[0], itemsResult.rows);
  }

  /**
   * POST /api/quotations - Create quotation with items in a single PostgreSQL transaction
   */
  async createQuotation({
    customerId,
    templateId = null,
    currency = 'INR',
    paymentTerms = null,
    validUntil,
    notes = null,
    items = []
  }) {
    // 1. Verify customer exists
    const customerCheck = await query('SELECT id FROM customers WHERE id = $1', [customerId]);
    if (customerCheck.rows.length === 0) {
      throw ApiError.notFound(`Customer with ID '${customerId}' not found`);
    }

    // 2. Validate product/variant/plan references and compute financial totals
    let subtotalPaise = 0n;
    let discountPaise = 0n;
    let taxPaise = 0n;
    const preparedItems = [];

    for (const item of items) {
      // Validate product exists
      const pCheck = await query('SELECT id, name FROM products WHERE id = $1', [item.productId]);
      if (pCheck.rows.length === 0) {
        throw ApiError.notFound(`Product with ID '${item.productId}' not found`);
      }

      if (item.variantId) {
        const vCheck = await query('SELECT id FROM product_variants WHERE id = $1 AND product_id = $2', [
          item.variantId,
          item.productId
        ]);
        if (vCheck.rows.length === 0) {
          throw ApiError.notFound(`Variant with ID '${item.variantId}' does not belong to product '${item.productId}'`);
        }
      }

      if (item.planId) {
        const planCheck = await query('SELECT id FROM subscription_plans WHERE id = $1', [item.planId]);
        if (planCheck.rows.length === 0) {
          throw ApiError.notFound(`Subscription plan with ID '${item.planId}' not found`);
        }
      }

      const qty = BigInt(item.quantity || 1);
      const unitPrice = BigInt(item.unitPricePaise || 0);
      const itemDiscount = BigInt(item.discountPaise || 0);
      const itemTax = BigInt(item.taxPaise || 0);
      const lineTotal = (qty * unitPrice) - itemDiscount + itemTax;

      subtotalPaise += qty * unitPrice;
      discountPaise += itemDiscount;
      taxPaise += itemTax;

      preparedItems.push({
        id: crypto.randomUUID(),
        productId: item.productId,
        variantId: item.variantId || null,
        planId: item.planId || null,
        description: item.description || pCheck.rows[0].name,
        quantity: Number(qty),
        unitPricePaise: Number(unitPrice),
        discountPaise: Number(itemDiscount),
        taxPaise: Number(itemTax),
        totalPaise: Number(lineTotal)
      });
    }

    const totalPaise = subtotalPaise - discountPaise + taxPaise;
    const quotationId = crypto.randomUUID();
    const quotationNumber = `QT-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;

    // 3. Insert quotation and quotation items in a single transaction
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO quotations (
           id, number, customer_id, template_id, status, currency,
           payment_terms, issued_at, valid_until, subtotal_paise,
           tax_paise, discount_paise, total_paise, notes, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, 'draft', $5,
           $6, NOW(), $7, $8,
           $9, $10, $11, $12, NOW(), NOW()
         )`,
        [
          quotationId,
          quotationNumber,
          customerId,
          templateId,
          currency,
          paymentTerms,
          validUntil,
          subtotalPaise.toString(),
          taxPaise.toString(),
          discountPaise.toString(),
          totalPaise.toString(),
          notes
        ]
      );

      for (const item of preparedItems) {
        await client.query(
          `INSERT INTO quotation_items (
             id, quotation_id, product_id, variant_id, plan_id,
             description, quantity, unit_price_paise, discount_paise,
             tax_paise, total_paise
           ) VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9,
             $10, $11
           )`,
          [
            item.id,
            quotationId,
            item.productId,
            item.variantId,
            item.planId,
            item.description,
            item.quantity,
            item.unitPricePaise,
            item.discountPaise,
            item.taxPaise,
            item.totalPaise
          ]
        );
      }
    });

    return this.getQuotationById(quotationId);
  }

  /**
   * PUT /api/quotations/:id - Update draft quotation
   */
  async updateQuotation(quotationId, data) {
    const existing = await this.getQuotationById(quotationId);
    if (!existing) {
      throw ApiError.notFound(`Quotation with ID '${quotationId}' not found`);
    }

    if (existing.status !== 'draft') {
      throw ApiError.badRequest(`Only draft quotations can be updated. Current status is '${existing.status}'`);
    }

    await withTransaction(async (client) => {
      let subtotalPaise = BigInt(existing.subtotalPaise);
      let discountPaise = BigInt(existing.discountPaise);
      let taxPaise = BigInt(existing.taxPaise);

      if (data.items && data.items.length > 0) {
        // Delete old items
        await client.query('DELETE FROM quotation_items WHERE quotation_id = $1', [quotationId]);

        subtotalPaise = 0n;
        discountPaise = 0n;
        taxPaise = 0n;

        for (const item of data.items) {
          const qty = BigInt(item.quantity || 1);
          const unitPrice = BigInt(item.unitPricePaise || 0);
          const itemDiscount = BigInt(item.discountPaise || 0);
          const itemTax = BigInt(item.taxPaise || 0);
          const lineTotal = (qty * unitPrice) - itemDiscount + itemTax;

          subtotalPaise += qty * unitPrice;
          discountPaise += itemDiscount;
          taxPaise += itemTax;

          await client.query(
            `INSERT INTO quotation_items (
               id, quotation_id, product_id, variant_id, plan_id,
               description, quantity, unit_price_paise, discount_paise,
               tax_paise, total_paise
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              crypto.randomUUID(),
              quotationId,
              item.productId,
              item.variantId || null,
              item.planId || null,
              item.description,
              Number(qty),
              Number(unitPrice),
              Number(itemDiscount),
              Number(itemTax),
              Number(lineTotal)
            ]
          );
        }
      }

      const totalPaise = subtotalPaise - discountPaise + taxPaise;

      const updates = [];
      const params = [];
      let pIdx = 1;

      if (data.validUntil) {
        updates.push(`valid_until = $${pIdx}`);
        params.push(data.validUntil);
        pIdx++;
      }
      if (data.paymentTerms !== undefined) {
        updates.push(`payment_terms = $${pIdx}`);
        params.push(data.paymentTerms);
        pIdx++;
      }
      if (data.notes !== undefined) {
        updates.push(`notes = $${pIdx}`);
        params.push(data.notes);
        pIdx++;
      }

      if (data.items && data.items.length > 0) {
        updates.push(`subtotal_paise = $${pIdx}`);
        params.push(subtotalPaise.toString());
        pIdx++;

        updates.push(`discount_paise = $${pIdx}`);
        params.push(discountPaise.toString());
        pIdx++;

        updates.push(`tax_paise = $${pIdx}`);
        params.push(taxPaise.toString());
        pIdx++;

        updates.push(`total_paise = $${pIdx}`);
        params.push(totalPaise.toString());
        pIdx++;
      }

      if (updates.length > 0) {
        updates.push('updated_at = NOW()');
        params.push(quotationId);
        await client.query(`UPDATE quotations SET ${updates.join(', ')} WHERE id = $${pIdx}`, params);
      }
    });

    return this.getQuotationById(quotationId);
  }

  /**
   * PATCH /api/quotations/:id/status - Update quotation status
   * Supported statuses: draft, sent, accepted, declined, expired
   */
  async updateQuotationStatus(quotationId, newStatus, actorRole = 'admin') {
    const existing = await this.getQuotationById(quotationId);
    if (!existing) {
      throw ApiError.notFound(`Quotation with ID '${quotationId}' not found`);
    }

    // Customer can only accept or decline a quotation that has been sent
    if (actorRole === 'customer') {
      if (existing.status !== 'sent') {
        throw ApiError.badRequest(`Customer can only respond to quotations with status 'sent'. Current: '${existing.status}'`);
      }
      if (!['accepted', 'declined'].includes(newStatus)) {
        throw ApiError.forbidden(`Customers can only accept or decline quotations.`);
      }
    }

    await query(
      'UPDATE quotations SET status = $1, updated_at = NOW() WHERE id = $2',
      [newStatus, quotationId]
    );

    return this.getQuotationById(quotationId);
  }

  /**
   * DELETE /api/quotations/:id - Delete quotation (drafts only)
   */
  async deleteQuotation(quotationId) {
    const existing = await this.getQuotationById(quotationId);
    if (!existing) {
      throw ApiError.notFound(`Quotation with ID '${quotationId}' not found`);
    }

    if (existing.status !== 'draft') {
      throw ApiError.badRequest(`Only draft quotations can be deleted. Quotation '${existing.number}' is '${existing.status}'`);
    }

    await query('DELETE FROM quotations WHERE id = $1', [quotationId]);

    return {
      id: quotationId,
      number: existing.number,
      deleted: true,
      message: 'Draft quotation deleted successfully'
    };
  }
}

export const quotationService = new QuotationService();
export default quotationService;

