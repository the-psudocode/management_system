import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { checkDatabaseHealth, query, closeDatabase } from '../src/database/index.js';
import { authService } from '../src/modules/auth/auth.service.js';
import { productService } from '../src/modules/product/product.service.js';
import auth, { setFirebaseAuth, resetFirebaseAuth, MockFirebaseAuth } from '../src/config/firebase.js';

const uid = () => Math.random().toString(36).substring(2, 8).toUpperCase();

describe('Brightloop Billing - Product & Variant Management Suite', () => {
  let app;
  let server;
  let baseUrl;
  let isDbConnected = false;

  let adminToken;
  let staffToken;
  let customerToken;

  let adminUser;
  let staffUser;
  let customerUser;

  let mockAuthInstance;

  before(async () => {
    mockAuthInstance = new MockFirebaseAuth();
    setFirebaseAuth(mockAuthInstance);

    app = createApp();

    const health = await checkDatabaseHealth();
    isDbConnected = health.alive;

    if (!isDbConnected) {
      console.log(`[Product Test] PostgreSQL not connected (${health.error || 'DATABASE_URL not set'}).`);
      return;
    }

    // Clean test state for idempotent test runs
    await query('DELETE FROM product_variants; DELETE FROM products; DELETE FROM customers; DELETE FROM users;');

    // Start HTTP server on dynamic port
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // 1. Seed Admin
    adminUser = await authService.seedAdminIfNotExists({
      email: `admin.prod.${uid()}@brightloop.io`,
      password: 'AdminPassword123!',
      name: 'Admin Prod Test'
    });
    adminToken = auth.createMockToken(adminUser.firebaseUid, adminUser.email, adminUser.name);

    // 2. Seed Staff
    staffUser = await authService.createStaffAccount(
      {
        email: `staff.prod.${uid()}@brightloop.io`,
        password: 'StaffPassword123!',
        name: 'Staff Prod Test',
        role: 'staff'
      },
      adminUser
    );
    staffToken = auth.createMockToken(staffUser.firebaseUid, staffUser.email, staffUser.name);

    // 3. Seed Customer
    customerUser = await authService.registerCustomer({
      email: `customer.prod.${uid()}@alpha.com`,
      password: 'CustPassword123!',
      name: 'Alpha Customer',
      companyName: 'Alpha Corp',
      phone: '+91 9888877777',
      billingAddress: 'Outer Ring Road, Bangalore'
    });
    customerToken = auth.createMockToken(customerUser.firebaseUid, customerUser.email, customerUser.name);
  });

  after(async () => {
    resetFirebaseAuth();
    if (server) server.close();
    await closeDatabase();
  });

  // =========================================================================
  // 1. CREATE PRODUCT (POST /api/products)
  // =========================================================================
  describe('1. Create Product (POST /api/products)', () => {
    test('Admin can create a product with valid fields', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const payload = {
        name: 'Cloud Hosting Enterprise',
        description: 'Dedicated cloud server with high availability',
        type: 'infrastructure',
        salesPricePaise: 499900, // 4,999.00 INR
        costPricePaise: 250000,
        status: 'active'
      };

      const res = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.name, 'Cloud Hosting Enterprise');
      assert.equal(json.data.salesPricePaise, 499900);
      assert.equal(json.data.basePriceInPaise, 499900);
      assert.equal(json.data.costPricePaise, 250000);
      assert.equal(json.data.type, 'infrastructure');
      assert.equal(json.data.category, 'infrastructure');
      assert.equal(json.data.status, 'active');
      assert.equal(json.data.isActive, true);
      assert.ok(json.data.id);
    });

    test('Admin can create a product with initial embedded variants in a single transaction', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const sku1 = `EMS-START-${uid()}`;
      const sku2 = `EMS-PRO-${uid()}`;
      const payload = {
        name: 'Email Marketing Suite',
        description: 'Automated email workflows',
        type: 'software',
        salesPricePaise: 99900,
        costPricePaise: 20000,
        variants: [
          { name: 'Starter Tier (10k emails)', sku: sku1, pricePaise: 99900, currency: 'INR' },
          { name: 'Pro Tier (50k emails)', sku: sku2, pricePaise: 299900, currency: 'INR' }
        ]
      };

      const res = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.name, 'Email Marketing Suite');
      assert.equal(json.data.variants.length, 2);
      assert.equal(json.data.variants[0].sku, sku1);
      assert.equal(json.data.variants[0].pricePaise, 99900);
      assert.equal(json.data.variants[1].sku, sku2);
      assert.equal(json.data.variants[1].pricePaise, 299900);
    });

    test('Staff can create a product', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const payload = {
        name: 'Technical Support Retainer',
        description: '24/7 dedicated DevOps support',
        type: 'support',
        salesPricePaise: 1500000,
        costPricePaise: 500000
      };

      const res = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`
        },
        body: JSON.stringify(payload)
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.name, 'Technical Support Retainer');
    });

    test('Rejects creation when product name is empty (400 Bad Request)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ name: '   ', salesPricePaise: 1000 })
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.ok(json.message);
    });

    test('Rejects negative prices (400 Bad Request)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ name: 'Invalid Product', salesPricePaise: -500 })
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.ok(json.message);
    });

    test('Rejects creation when variant SKU is duplicate (409 Conflict)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const dupSku = `DUP-${uid()}`;
      await productService.createProduct({
        name: 'Existing Prod With SKU',
        variants: [{ name: 'Tier 1', sku: dupSku, pricePaise: 5000 }]
      });

      const payload = {
        name: 'Duplicate SKU Product',
        variants: [
          { name: 'Dupe Tier', sku: dupSku, pricePaise: 1000 }
        ]
      };

      const res = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });

      assert.equal(res.status, 409);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.ok(json.message);
    });

    test('Customer role CANNOT create products (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerToken}`
        },
        body: JSON.stringify({ name: 'Unauthorized Product' })
      });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.ok(json.message);
    });

    test('Unauthenticated request is rejected (401 Unauthorized)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'No Auth Product' })
      });

      assert.equal(res.status, 401);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.ok(json.message);
    });
  });

  // =========================================================================
  // 2. LIST PRODUCTS (GET /api/products)
  // =========================================================================
  describe('2. List Products (GET /api/products)', () => {
    test('Admin can list products with pagination and metadata', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products?page=1&limit=2`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(Array.isArray(json.data.data));
      assert.equal(json.data.data.length, 2);
      assert.equal(json.data.pagination.page, 1);
      assert.equal(json.data.pagination.pageSize, 2);
      assert.ok(json.data.pagination.total >= 3);
      assert.ok(json.data.pagination.totalPages >= 2);
      assert.equal(json.data.pagination.hasNextPage, true);
    });

    test('Staff can search products by name or description', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products?search=Marketing`, {
        headers: { Authorization: `Bearer ${staffToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.data.length >= 1);
      assert.ok(json.data.data.some((p) => p.name.includes('Email Marketing')));
    });

    test('Filters products by type/category', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products?type=infrastructure`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.data.every((p) => p.type === 'infrastructure'));
    });

    test('Filters products by status', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products?status=active`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.data.every((p) => p.status === 'active'));
    });

    test('Customer role CANNOT list products via admin endpoint (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products`, {
        headers: { Authorization: `Bearer ${customerToken}` }
      });

      assert.equal(res.status, 403);
    });
  });

  // =========================================================================
  // 3. GET PRODUCT BY ID (GET /api/products/:id)
  // =========================================================================
  describe('3. View Product Details (GET /api/products/:id)', () => {
    let createdProduct;

    before(async () => {
      if (!isDbConnected) return;
      createdProduct = await productService.createProduct({
        name: 'Analytics Dashboard Pro',
        description: 'Realtime telemetry and metrics',
        type: 'analytics',
        salesPricePaise: 199900,
        variants: [
          { name: 'Standard Seat', sku: `ANLYT-${uid()}`, pricePaise: 199900 }
        ]
      });
    });

    test('Admin can view product details with variants', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products/${createdProduct.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.id, createdProduct.id);
      assert.equal(json.data.name, 'Analytics Dashboard Pro');
      assert.equal(json.data.variants.length, 1);
    });

    test('Staff can view product details', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products/${createdProduct.id}`, {
        headers: { Authorization: `Bearer ${staffToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.name, 'Analytics Dashboard Pro');
    });

    test('Returns 404 for non-existent product ID', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products/non-existent-product-id`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 404);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.ok(json.message);
    });

    test('Customer role CANNOT view product via management API (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products/${createdProduct.id}`, {
        headers: { Authorization: `Bearer ${customerToken}` }
      });

      assert.equal(res.status, 403);
    });
  });

  // =========================================================================
  // 4. UPDATE PRODUCT (PUT /api/products/:id)
  // =========================================================================
  describe('4. Update Product (PUT /api/products/:id)', () => {
    let targetProduct;

    before(async () => {
      if (!isDbConnected) return;
      targetProduct = await productService.createProduct({
        name: 'Database Backup Service',
        description: 'Automated nightly backups',
        type: 'storage',
        salesPricePaise: 89900
      });
    });

    test('Admin can update product fields', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products/${targetProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Database Backup Service Enterprise',
          salesPricePaise: 119900,
          description: 'Continuous WAL archiving + daily backups'
        })
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.name, 'Database Backup Service Enterprise');
      assert.equal(json.data.salesPricePaise, 119900);
      assert.equal(json.data.basePriceInPaise, 119900);
      assert.equal(json.data.description, 'Continuous WAL archiving + daily backups');
    });

    test('Staff can update product details', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products/${targetProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`
        },
        body: JSON.stringify({
          type: 'managed-storage'
        })
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.type, 'managed-storage');
    });

    test('Rejects update when payload is empty (400 Bad Request)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products/${targetProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({})
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.ok(json.message);
    });

    test('Returns 404 for non-existent product ID', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products/missing-prod-id`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ name: 'New Name' })
      });

      assert.equal(res.status, 404);
      const json = await res.json();
      assert.equal(json.success, false);
    });

    test('Customer role CANNOT update product (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products/${targetProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerToken}`
        },
        body: JSON.stringify({ name: 'Hacked Name' })
      });

      assert.equal(res.status, 403);
    });
  });

  // =========================================================================
  // 5. PRODUCT STATUS & SAFE DEACTIVATION (PATCH /api/products/:id/status & DELETE)
  // =========================================================================
  describe('5. Status & Safe Archival', () => {
    let testProduct;

    before(async () => {
      if (!isDbConnected) return;
      testProduct = await productService.createProduct({
        name: 'Legacy Microservice Gateway',
        status: 'active'
      });
    });

    test('Admin can update product status via PATCH /:id/status to archived', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products/${testProduct.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: 'archived' })
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.status, 'archived');
      assert.equal(json.data.isActive, false);
    });

    test('Admin can reactivate product to active', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products/${testProduct.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: 'active' })
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.status, 'active');
      assert.equal(json.data.isActive, true);
    });

    test('Rejects invalid status value (400 Bad Request)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products/${testProduct.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: 'deleted_forever' })
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.ok(json.message);
    });

    test('DELETE /api/products/:id performs safe archival without dropping row', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products/${testProduct.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.archived, true);
      assert.equal(json.data.status, 'archived');

      // Verify row is preserved in database with status='archived'
      const check = await productService.getProductById(testProduct.id);
      assert.ok(check);
      assert.equal(check.status, 'archived');
    });
  });

  // =========================================================================
  // 6. PRODUCT VARIANTS CRUD
  // =========================================================================
  describe('6. Product Variants CRUD', () => {
    let parentProduct;
    let variant1;

    before(async () => {
      if (!isDbConnected) return;
      parentProduct = await productService.createProduct({
        name: 'CDN Bandwidth Package',
        type: 'bandwidth',
        salesPricePaise: 50000
      });
    });

    test('Admin can create a variant for the product (POST /:productId/variants)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const variantSku = `CDN-${uid()}`;
      const payload = {
        name: 'Asia-Pacific Region 1TB',
        sku: variantSku,
        pricePaise: 75000,
        currency: 'INR'
      };

      const res = await fetch(`${baseUrl}/api/products/${parentProduct.id}/variants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.name, 'Asia-Pacific Region 1TB');
      assert.equal(json.data.sku, variantSku);
      assert.equal(json.data.pricePaise, 75000);
      assert.equal(json.data.priceInPaise, 75000);
      assert.equal(json.data.productId, parentProduct.id);
      variant1 = json.data;
    });

    test('Rejects duplicate variant SKU (409 Conflict)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const payload = {
        name: 'Another APAC Variant',
        sku: variant1.sku, // Duplicate SKU of existing variant1
        pricePaise: 80000
      };

      const res = await fetch(`${baseUrl}/api/products/${parentProduct.id}/variants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });

      assert.equal(res.status, 409);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.ok(json.message);
    });

    test('Admin and Staff can list variants for a product', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products/${parentProduct.id}/variants`, {
        headers: { Authorization: `Bearer ${staffToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(Array.isArray(json.data));
      assert.equal(json.data.length, 1);
      assert.equal(json.data[0].id, variant1.id);
    });

    test('Admin and Staff can retrieve single variant by ID', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products/variants/${variant1.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.id, variant1.id);
      assert.equal(json.data.name, 'Asia-Pacific Region 1TB');
    });

    test('Admin can update variant details (PUT /variants/:id)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products/variants/${variant1.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Asia-Pacific Regional CDN (Updated)',
          pricePaise: 82000
        })
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.name, 'Asia-Pacific Regional CDN (Updated)');
      assert.equal(json.data.pricePaise, 82000);
    });

    test('Rejects variant creation for non-existent parent product (404 Not Found)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products/ghost-product-id/variants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Ghost Variant',
          sku: `GHOST-${uid()}`,
          pricePaise: 10000
        })
      });

      assert.equal(res.status, 404);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.ok(json.message);
    });

    test('Customer role CANNOT manage variants (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products/${parentProduct.id}/variants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerToken}`
        },
        body: JSON.stringify({
          name: 'Unauthorized Variant',
          sku: `UNAUTH-${uid()}`,
          pricePaise: 1000
        })
      });

      assert.equal(res.status, 403);
    });

    test('Admin can delete a variant (DELETE /variants/:id)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/products/variants/${variant1.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.deleted, true);

      // Verify variant is gone
      const verify = await productService.getVariantById(variant1.id);
      assert.equal(verify, null);
    });
  });
});
