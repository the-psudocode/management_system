import { Router } from 'express';
import { productController } from './product.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  listProductsQuerySchema,
  productIdParamSchema,
  variantIdParamSchema,
  createProductSchema,
  updateProductSchema,
  updateProductStatusSchema,
  createVariantSchema,
  updateVariantSchema
} from './product.validation.js';

export const createProductRouter = () => {
  const router = Router();

  // All product routes require authentication and admin/staff privileges
  router.use(authenticate);
  router.use(authorizeRoles('admin', 'staff'));

  // =========================================================================
  // Product Variant Direct Routes (mounted before generic /:id)
  // =========================================================================

  /**
   * @route   GET /api/products/variants/:id
   * @desc    Retrieve variant details by variant ID
   * @access  Protected (Admin and Staff only)
   */
  router.get(
    '/variants/:id',
    validate(variantIdParamSchema, 'params'),
    productController.getVariant
  );

  /**
   * @route   PUT /api/products/variants/:id
   * @desc    Update variant details by variant ID
   * @access  Protected (Admin and Staff only)
   */
  router.put(
    '/variants/:id',
    validate(variantIdParamSchema, 'params'),
    validate(updateVariantSchema, 'body'),
    productController.updateVariant
  );

  /**
   * @route   DELETE /api/products/variants/:id
   * @desc    Delete a variant by variant ID
   * @access  Protected (Admin and Staff only)
   */
  router.delete(
    '/variants/:id',
    validate(variantIdParamSchema, 'params'),
    productController.deleteVariant
  );

  // =========================================================================
  // Core Product Collection Routes
  // =========================================================================

  /**
   * @route   GET /api/products
   * @desc    List products with pagination, search, status, and type filtering
   * @access  Protected (Admin and Staff only)
   */
  router.get(
    '/',
    validate(listProductsQuerySchema, 'query'),
    productController.listProducts
  );

  /**
   * @route   POST /api/products
   * @desc    Create a new product with optional initial variants
   * @access  Protected (Admin and Staff only)
   */
  router.post(
    '/',
    validate(createProductSchema, 'body'),
    productController.createProduct
  );

  // =========================================================================
  // Nested Variant Routes under /api/products/:productId/variants
  // =========================================================================

  /**
   * @route   GET /api/products/:productId/variants
   * @desc    List all variants belonging to a product
   * @access  Protected (Admin and Staff only)
   */
  router.get(
    '/:productId/variants',
    validate(productIdParamSchema, 'params'),
    productController.listVariants
  );

  /**
   * @route   POST /api/products/:productId/variants
   * @desc    Create a new variant for a product
   * @access  Protected (Admin and Staff only)
   */
  router.post(
    '/:productId/variants',
    validate(productIdParamSchema, 'params'),
    validate(createVariantSchema, 'body'),
    productController.createVariant
  );

  /**
   * @route   PUT /api/products/:productId/variants/:variantId
   * @desc    Update a variant under a product
   * @access  Protected (Admin and Staff only)
   */
  router.put(
    '/:productId/variants/:variantId',
    validate(variantIdParamSchema, 'params'),
    validate(updateVariantSchema, 'body'),
    productController.updateVariant
  );

  /**
   * @route   DELETE /api/products/:productId/variants/:variantId
   * @desc    Delete a variant under a product
   * @access  Protected (Admin and Staff only)
   */
  router.delete(
    '/:productId/variants/:variantId',
    validate(variantIdParamSchema, 'params'),
    productController.deleteVariant
  );

  // =========================================================================
  // Product by ID Routes
  // =========================================================================

  /**
   * @route   GET /api/products/:id
   * @desc    Retrieve product details with variants
   * @access  Protected (Admin and Staff only)
   */
  router.get(
    '/:id',
    validate(productIdParamSchema, 'params'),
    productController.getProduct
  );

  /**
   * @route   PUT /api/products/:id
   * @desc    Update product details
   * @access  Protected (Admin and Staff only)
   */
  router.put(
    '/:id',
    validate(productIdParamSchema, 'params'),
    validate(updateProductSchema, 'body'),
    productController.updateProduct
  );

  /**
   * @route   PATCH /api/products/:id/status
   * @desc    Activate or deactivate (archive) a product
   * @access  Protected (Admin and Staff only)
   */
  router.patch(
    '/:id/status',
    validate(productIdParamSchema, 'params'),
    validate(updateProductStatusSchema, 'body'),
    productController.updateStatus
  );

  /**
   * @route   DELETE /api/products/:id
   * @desc    Safely archive a product
   * @access  Protected (Admin and Staff only)
   */
  router.delete(
    '/:id',
    validate(productIdParamSchema, 'params'),
    productController.deleteProduct
  );

  return router;
};

export const productRouter = createProductRouter();
export default productRouter;

