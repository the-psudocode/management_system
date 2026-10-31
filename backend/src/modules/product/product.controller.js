import { productService } from './product.service.js';
import { sendSuccess } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';

export class ProductController {
  /**
   * GET /api/products
   * List products with pagination, search, status, and type filtering
   * Access: Admin, Staff
   */
  async listProducts(req, res, next) {
    try {
      const result = await productService.listProducts(req.query);
      return sendSuccess(res, result, 'Products retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/products/:id
   * Retrieve single product with its variants
   * Access: Admin, Staff
   */
  async getProduct(req, res, next) {
    try {
      const product = await productService.getProductById(req.params.id);
      if (!product) {
        throw ApiError.notFound(`Product with ID '${req.params.id}' not found`);
      }
      return sendSuccess(res, product, 'Product details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/products
   * Create a new product with optional initial variants
   * Access: Admin, Staff
   */
  async createProduct(req, res, next) {
    try {
      const product = await productService.createProduct(req.body);
      return sendSuccess(res, product, 'Product created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/products/:id
   * Update product details
   * Access: Admin, Staff
   */
  async updateProduct(req, res, next) {
    try {
      const updated = await productService.updateProduct(req.params.id, req.body);
      return sendSuccess(res, updated, 'Product updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/products/:id/status
   * Activate or deactivate (archive) product
   * Access: Admin, Staff
   */
  async updateStatus(req, res, next) {
    try {
      const updated = await productService.updateProductStatus(req.params.id, req.body.status);
      return sendSuccess(res, updated, 'Product status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/products/:id
   * Safe archival of product
   * Access: Admin only (or Admin/Staff if configured)
   */
  async deleteProduct(req, res, next) {
    try {
      const result = await productService.deleteProduct(req.params.id);
      return sendSuccess(res, result, 'Product archived successfully');
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // PRODUCT VARIANTS
  // =========================================================================

  /**
   * GET /api/products/:productId/variants
   * List variants belonging to a product
   * Access: Admin, Staff
   */
  async listVariants(req, res, next) {
    try {
      const productId = req.params.productId || req.params.id;
      const variants = await productService.listVariantsByProductId(productId);
      return sendSuccess(res, variants, 'Product variants retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/products/variants/:id or /api/products/:productId/variants/:variantId
   * Retrieve single variant
   * Access: Admin, Staff
   */
  async getVariant(req, res, next) {
    try {
      const variantId = req.params.variantId || req.params.id;
      const variant = await productService.getVariantById(variantId);
      if (!variant) {
        throw ApiError.notFound(`Product variant with ID '${variantId}' not found`);
      }
      return sendSuccess(res, variant, 'Product variant retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/products/:productId/variants
   * Create a variant for a specific product
   * Access: Admin, Staff
   */
  async createVariant(req, res, next) {
    try {
      const productId = req.params.productId || req.params.id;
      const variant = await productService.createVariant(productId, req.body);
      return sendSuccess(res, variant, 'Product variant created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/products/variants/:id or /api/products/:productId/variants/:variantId
   * Update variant details
   * Access: Admin, Staff
   */
  async updateVariant(req, res, next) {
    try {
      const variantId = req.params.variantId || req.params.id;
      const updated = await productService.updateVariant(variantId, req.body);
      return sendSuccess(res, updated, 'Product variant updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/products/variants/:id or /api/products/:productId/variants/:variantId
   * Delete a variant
   * Access: Admin, Staff
   */
  async deleteVariant(req, res, next) {
    try {
      const variantId = req.params.variantId || req.params.id;
      const result = await productService.deleteVariant(variantId);
      return sendSuccess(res, result, 'Product variant deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const productController = new ProductController();
export default productController;

