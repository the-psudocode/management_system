import crypto from 'node:crypto';
import { query, withTransaction } from '../../database/index.js';
import { ApiError } from '../../utils/ApiError.js';

export class ProductService {
  /**
   * Helper to format raw product row + its variants into standard response shape
   * including frontend-compatible field aliases (category, basePriceInPaise, isActive, etc.)
   */
  formatProduct(row, variants = []) {
    if (!row) return null;
    const isActive = row.status === 'active';
    const salesPrice = Number(row.sales_price_paise || 0);
    const costPrice = Number(row.cost_price_paise || 0);

    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      notes: row.description || '', // Alias for notes
      type: row.type || 'service',
      category: row.type || 'service', // Frontend alias
      status: row.status,
      isActive, // Frontend alias
      salesPricePaise: salesPrice,
      sales_price_paise: salesPrice,
      basePriceInPaise: salesPrice, // Frontend alias
      costPricePaise: costPrice,
      cost_price_paise: costPrice,
      variants: variants.map((v) => this.formatVariant(v)),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Helper to format raw product variant row
   */
  formatVariant(row) {
    if (!row) return null;
    const price = Number(row.price_paise || 0);
    return {
      id: row.id,
      productId: row.product_id,
      product_id: row.product_id,
      sku: row.sku,
      name: row.name,
      pricePaise: price,
      price_paise: price,
      priceInPaise: price, // Frontend alias
      currency: row.currency || 'INR',
      isActive: true, // Frontend alias
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Check SKU uniqueness across product variants
   */
  async checkSkuAvailability(sku, excludeVariantId = null) {
    const normalizedSku = sku.trim().toLowerCase();
    let sql = 'SELECT id FROM product_variants WHERE LOWER(sku) = LOWER($1)';
    const params = [normalizedSku];

    if (excludeVariantId) {
      sql += ' AND id != $2';
      params.push(excludeVariantId);
    }

    const result = await query(sql, params);
    return result.rows.length === 0;
  }

  /**
   * GET /api/products - List products with pagination, search, status & type filtering
   */
  async listProducts({
    page = 1,
    limit = 10,
    search = '',
    status = 'all',
    type,
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = {}) {
    const whereConditions = [];
    const params = [];
    let paramIndex = 1;

    // Status filter
    if (status && status !== 'all') {
      whereConditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    // Type / category filter
    if (type && type.trim() !== '' && type.toLowerCase() !== 'all') {
      whereConditions.push(`LOWER(type) = LOWER($${paramIndex})`);
      params.push(type.trim());
      paramIndex++;
    }

    // Search filter on name and description
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      whereConditions.push(
        `(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`
      );
      params.push(searchTerm);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count total matching records
    const countSql = `SELECT COUNT(*) AS total FROM products ${whereClause}`;
    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Sorting column validation
    const allowedSortColumns = {
      created_at: 'created_at',
      name: 'name',
      sales_price_paise: 'sales_price_paise'
    };
    const sortColumn = allowedSortColumns[sortBy] || 'created_at';
    const direction = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Pagination calculations
    const offset = (page - 1) * limit;
    const paginationParams = [...params, limit, offset];
    const dataSql = `
      SELECT id, name, description, status, type, sales_price_paise, cost_price_paise, created_at, updated_at
      FROM products
      ${whereClause}
      ORDER BY ${sortColumn} ${direction}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataResult = await query(dataSql, paginationParams);
    const products = dataResult.rows;

    // Batch fetch variants for all returned products
    let variantsByProductId = new Map();
    if (products.length > 0) {
      const productIds = products.map((p) => p.id);
      const variantsSql = `
        SELECT id, product_id, sku, name, price_paise, currency, created_at, updated_at
        FROM product_variants
        WHERE product_id = ANY($1)
        ORDER BY created_at ASC
      `;
      const variantsResult = await query(variantsSql, [productIds]);
      for (const variant of variantsResult.rows) {
        if (!variantsByProductId.has(variant.product_id)) {
          variantsByProductId.set(variant.product_id, []);
        }
        variantsByProductId.get(variant.product_id).push(variant);
      }
    }

    const data = products.map((product) =>
      this.formatProduct(product, variantsByProductId.get(product.id) || [])
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
   * GET /api/products/:id - Retrieve single product by ID along with all its variants
   */
  async getProductById(productId) {
    const productSql = `
      SELECT id, name, description, status, type, sales_price_paise, cost_price_paise, created_at, updated_at
      FROM products
      WHERE id = $1
    `;
    const productResult = await query(productSql, [productId]);
    if (productResult.rows.length === 0) {
      return null;
    }

    const variantsSql = `
      SELECT id, product_id, sku, name, price_paise, currency, created_at, updated_at
      FROM product_variants
      WHERE product_id = $1
      ORDER BY created_at ASC
    `;
    const variantsResult = await query(variantsSql, [productId]);

    return this.formatProduct(productResult.rows[0], variantsResult.rows);
  }

  /**
   * POST /api/products - Create a new product and optional initial variants in a single transaction
   */
  async createProduct({
    name,
    description = null,
    type = 'service',
    salesPricePaise = 0,
    costPricePaise = 0,
    status = 'active',
    variants = []
  }) {
    const productId = crypto.randomUUID();

    await withTransaction(async (client) => {
      // 1. Insert product
      await client.query(
        `INSERT INTO products (
           id, name, description, status, type, sales_price_paise, cost_price_paise, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [productId, name, description, status, type, salesPricePaise, costPricePaise]
      );

      // 2. Insert variants if supplied
      for (const variant of variants) {
        // Validate SKU uniqueness
        const skuCheck = await client.query(
          'SELECT id FROM product_variants WHERE LOWER(sku) = LOWER($1)',
          [variant.sku.trim()]
        );
        if (skuCheck.rows.length > 0) {
          throw ApiError.conflict(`Variant SKU '${variant.sku}' is already in use`);
        }

        const variantId = crypto.randomUUID();
        await client.query(
          `INSERT INTO product_variants (
             id, product_id, sku, name, price_paise, currency, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [
            variantId,
            productId,
            variant.sku.trim(),
            variant.name.trim(),
            variant.pricePaise || 0,
            variant.currency || 'INR'
          ]
        );
      }
    });

    return this.getProductById(productId);
  }

  /**
   * PUT /api/products/:id - Update product fields
   */
  async updateProduct(productId, { name, description, type, salesPricePaise, costPricePaise, status }) {
    const existing = await this.getProductById(productId);
    if (!existing) {
      throw ApiError.notFound(`Product with ID '${productId}' not found`);
    }

    const updates = [];
    const params = [];
    let pIdx = 1;

    if (name !== undefined) {
      updates.push(`name = $${pIdx}`);
      params.push(name);
      pIdx++;
    }

    if (description !== undefined) {
      updates.push(`description = $${pIdx}`);
      params.push(description);
      pIdx++;
    }

    if (type !== undefined) {
      updates.push(`type = $${pIdx}`);
      params.push(type);
      pIdx++;
    }

    if (salesPricePaise !== undefined) {
      updates.push(`sales_price_paise = $${pIdx}`);
      params.push(salesPricePaise);
      pIdx++;
    }

    if (costPricePaise !== undefined) {
      updates.push(`cost_price_paise = $${pIdx}`);
      params.push(costPricePaise);
      pIdx++;
    }

    if (status !== undefined) {
      updates.push(`status = $${pIdx}`);
      params.push(status);
      pIdx++;
    }

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      params.push(productId);
      const updateSql = `UPDATE products SET ${updates.join(', ')} WHERE id = $${pIdx}`;
      await query(updateSql, params);
    }

    return this.getProductById(productId);
  }

  /**
   * PATCH /api/products/:id/status - Toggle or set product status ('active' | 'archived')
   */
  async updateProductStatus(productId, status) {
    const existing = await this.getProductById(productId);
    if (!existing) {
      throw ApiError.notFound(`Product with ID '${productId}' not found`);
    }

    await query(
      `UPDATE products SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, productId]
    );

    return this.getProductById(productId);
  }

  /**
   * DELETE /api/products/:id - Safe deactivation/archive of a product
   */
  async deleteProduct(productId) {
    const existing = await this.getProductById(productId);
    if (!existing) {
      throw ApiError.notFound(`Product with ID '${productId}' not found`);
    }

    // Safe archival: Set status to 'archived' to preserve foreign-key integrity with subscription plans
    await query(
      `UPDATE products SET status = 'archived', updated_at = NOW() WHERE id = $1`,
      [productId]
    );

    return {
      id: productId,
      status: 'archived',
      archived: true,
      message: 'Product archived successfully'
    };
  }

  // =========================================================================
  // PRODUCT VARIANTS
  // =========================================================================

  /**
   * GET /api/products/:productId/variants - List variants for a product
   */
  async listVariantsByProductId(productId) {
    const product = await query('SELECT id FROM products WHERE id = $1', [productId]);
    if (product.rows.length === 0) {
      throw ApiError.notFound(`Product with ID '${productId}' not found`);
    }

    const result = await query(
      `SELECT id, product_id, sku, name, price_paise, currency, created_at, updated_at
       FROM product_variants
       WHERE product_id = $1
       ORDER BY created_at ASC`,
      [productId]
    );

    return result.rows.map((row) => this.formatVariant(row));
  }

  /**
   * GET /api/products/variants/:id - Retrieve single variant
   */
  async getVariantById(variantId) {
    const result = await query(
      `SELECT id, product_id, sku, name, price_paise, currency, created_at, updated_at
       FROM product_variants
       WHERE id = $1`,
      [variantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.formatVariant(result.rows[0]);
  }

  /**
   * POST /api/products/:productId/variants - Create a new variant belonging to a product
   */
  async createVariant(productId, { name, sku, pricePaise, currency = 'INR' }) {
    // 1. Verify parent product exists
    const product = await query('SELECT id FROM products WHERE id = $1', [productId]);
    if (product.rows.length === 0) {
      throw ApiError.notFound(`Parent product with ID '${productId}' not found`);
    }

    // 2. Verify SKU availability
    const isAvailable = await this.checkSkuAvailability(sku);
    if (!isAvailable) {
      throw ApiError.conflict(`Variant with SKU '${sku}' already exists`);
    }

    const variantId = crypto.randomUUID();
    await query(
      `INSERT INTO product_variants (
         id, product_id, sku, name, price_paise, currency, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [variantId, productId, sku.trim(), name.trim(), pricePaise, currency]
    );

    return this.getVariantById(variantId);
  }

  /**
   * PUT /api/products/variants/:id - Update variant details
   */
  async updateVariant(variantId, { name, sku, pricePaise, currency }) {
    const existing = await this.getVariantById(variantId);
    if (!existing) {
      throw ApiError.notFound(`Variant with ID '${variantId}' not found`);
    }

    if (sku && sku.trim().toLowerCase() !== existing.sku.toLowerCase()) {
      const isAvailable = await this.checkSkuAvailability(sku, variantId);
      if (!isAvailable) {
        throw ApiError.conflict(`Variant with SKU '${sku}' already exists`);
      }
    }

    const updates = [];
    const params = [];
    let pIdx = 1;

    if (name !== undefined) {
      updates.push(`name = $${pIdx}`);
      params.push(name.trim());
      pIdx++;
    }

    if (sku !== undefined) {
      updates.push(`sku = $${pIdx}`);
      params.push(sku.trim());
      pIdx++;
    }

    if (pricePaise !== undefined) {
      updates.push(`price_paise = $${pIdx}`);
      params.push(pricePaise);
      pIdx++;
    }

    if (currency !== undefined) {
      updates.push(`currency = $${pIdx}`);
      params.push(currency.trim());
      pIdx++;
    }

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      params.push(variantId);
      const updateSql = `UPDATE product_variants SET ${updates.join(', ')} WHERE id = $${pIdx}`;
      await query(updateSql, params);
    }

    return this.getVariantById(variantId);
  }

  /**
   * DELETE /api/products/variants/:id - Delete a variant
   */
  async deleteVariant(variantId) {
    const existing = await this.getVariantById(variantId);
    if (!existing) {
      throw ApiError.notFound(`Variant with ID '${variantId}' not found`);
    }

    await query('DELETE FROM product_variants WHERE id = $1', [variantId]);

    return {
      id: variantId,
      productId: existing.productId,
      deleted: true,
      message: 'Product variant deleted successfully'
    };
  }
}

export const productService = new ProductService();
export default productService;

