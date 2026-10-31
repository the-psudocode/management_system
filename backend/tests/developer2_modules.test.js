import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { checkDatabaseHealth, query, closeDatabase } from '../src/database/index.js';
import { authService } from '../src/modules/auth/auth.service.js';
import { productService } from '../src/modules/product/product.service.js';
import { planService } from '../src/modules/plan/plan.service.js';
import { quotationService } from '../src/modules/quotation/quotation.service.js';
import { paymentService } from '../src/modules/payment/payment.service.js';
import auth, { setFirebaseAuth, resetFirebaseAuth, MockFirebaseAuth } from '../src/config/firebase.js';
import { cleanDatabase } from './helpers.js';

const uid = () => Math.random().toString(36).substring(2, 8).toUpperCase();

describe('Brightloop Billing — Developer 2 Modules Integration Suite', () => {
  let app;
  let server;
  let baseUrl;
  let isDbConnected = false;

  let adminToken;
  let staffToken;
  let customer1Token;
  let customer2Token;

  let adminUser;
  let staffUser;
  let customer1Record;
  let customer2Record;
  let baseProduct;

  let mockAuthInstance;

  before(async () => {
    mockAuthInstance = new MockFirebaseAuth();
    setFirebaseAuth(mockAuthInstance);

    app = createApp();

    const health = await checkDatabaseHealth();
    isDbConnected = health.alive;

    if (!isDbConnected) {
      console.log(`[Dev2 Test] PostgreSQL not connected (${health.error || 'DATABASE_URL not set'}).`);
      return;
    }

    // Clean test state for idempotent test runs
    await cleanDatabase();

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
      email: `admin.d2.${uid()}@brightloop.io`,
      password: 'AdminPassword123!',
      name: 'Admin Dev2 Test'
    });
    adminToken = auth.createMockToken(adminUser.firebaseUid, adminUser.email, adminUser.name);

    // 2. Seed Staff
    staffUser = await authService.createStaffAccount(
      {
        email: `staff.d2.${uid()}@brightloop.io`,
        password: 'StaffPassword123!',
        name: 'Staff Dev2 Test',
        role: 'staff'
      },
      adminUser
    );
    staffToken = auth.createMockToken(staffUser.firebaseUid, staffUser.email, staffUser.name);

    // 3. Seed Customer 1
    customer1Record = await authService.registerCustomer({
      email: `cust1.d2.${uid()}@alpha.com`,
      password: 'CustPassword123!',
      name: 'Alpha Customer',
      companyName: 'Alpha Corp',
      phone: '+91 9111122222',
      billingAddress: '100 Alpha Tech Park, Bangalore'
    });
    customer1Token = auth.createMockToken(customer1Record.firebaseUid, customer1Record.email, customer1Record.name);

    // 4. Seed Customer 2
    customer2Record = await authService.registerCustomer({
      email: `cust2.d2.${uid()}@beta.com`,
      password: 'CustPassword123!',
      name: 'Beta Customer',
      companyName: 'Beta Industries',
      phone: '+91 9333344444',
      billingAddress: '200 Beta Industrial Estate, Mumbai'
    });
    customer2Token = auth.createMockToken(customer2Record.firebaseUid, customer2Record.email, customer2Record.name);

    // 5. Seed Base Product
    baseProduct = await productService.createProduct({
      name: `Cloud Platform ${uid()}`,
      description: 'Standard enterprise compute',
      type: 'infrastructure',
      salesPricePaise: 150000
    });
  });

  after(async () => {
    resetFirebaseAuth();
    if (server) server.close();
    await closeDatabase();
  });

  // =========================================================================
  // MODULE A: SUBSCRIPTION PLANS
  // =========================================================================
  describe('Module A — Subscription Plan Management', () => {
    let createdPlan;

    test('Admin can create a subscription plan associated with a product', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const payload = {
        name: `Startup Tier ${uid()}`,
        productId: baseProduct.id,
        billingInterval: 'monthly',
        intervalCount: 1,
        amountPaise: 99900,
        currency: 'INR',
        description: 'Starter tier for early-stage companies',
        minimumQuantity: 1
      };

      const res = await fetch(`${baseUrl}/api/plans`, {
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
      assert.equal(json.data.productId, baseProduct.id);
      assert.equal(json.data.amountPaise, 99900);
      assert.equal(json.data.priceInPaise, 99900);
      assert.equal(json.data.billingInterval, 'monthly');
      assert.equal(json.data.status, 'active');
      createdPlan = json.data;
    });

    test('Rejects plan creation with invalid billing interval (400 Bad Request)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const payload = {
        name: 'Invalid Interval Plan',
        productId: baseProduct.id,
        billingInterval: 'hourly', // Invalid interval
        amountPaise: 1000
      };

      const res = await fetch(`${baseUrl}/api/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.ok(json.message);
    });

    test('Rejects plan creation when product does not exist (404 Not Found)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const payload = {
        name: 'Missing Product Plan',
        productId: 'non-existent-prod-id',
        billingInterval: 'yearly',
        amountPaise: 500000
      };

      const res = await fetch(`${baseUrl}/api/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });

      assert.equal(res.status, 404);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.ok(json.message);
    });

    test('Staff can list plans with pagination and metadata', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/plans?page=1&limit=5`, {
        headers: { Authorization: `Bearer ${staffToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(Array.isArray(json.data.data));
      assert.ok(json.data.pagination);
      assert.ok(json.data.data.length >= 1);
    });

    test('Admin and Staff can view single plan details by ID', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/plans/${createdPlan.id}`, {
        headers: { Authorization: `Bearer ${staffToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.id, createdPlan.id);
      assert.equal(json.data.name, createdPlan.name);
      assert.ok(json.data.productName);
    });

    test('Admin can update plan information (PUT /api/plans/:id)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/plans/${createdPlan.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          amountPaise: 119900,
          description: 'Updated tier description'
        })
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.amountPaise, 119900);
      assert.equal(json.data.priceInPaise, 119900);
    });

    test('Customer role CANNOT access plan management endpoints (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/plans`, {
        headers: { Authorization: `Bearer ${customer1Token}` }
      });

      assert.equal(res.status, 403);
    });

    test('Admin can safely archive a plan (DELETE /api/plans/:id)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/plans/${createdPlan.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.status, 'archived');
      assert.equal(json.data.archived, true);
    });
  });

  // =========================================================================
  // MODULE B: QUOTATIONS
  // =========================================================================
  describe('Module B — Quotation Management', () => {
    let createdQuotation;

    test('Admin/Staff can create a quotation for a customer with calculated totals', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const payload = {
        customerId: customer1Record.customer.id,
        validUntil: '2026-12-31',
        paymentTerms: 'Net 30',
        notes: 'Annual contract quotation',
        items: [
          {
            productId: baseProduct.id,
            description: 'Custom Platform License',
            quantity: 2,
            unitPricePaise: 100000, // 1000.00 each
            discountPaise: 10000,
            taxPaise: 18000
          }
        ]
      };

      const res = await fetch(`${baseUrl}/api/quotations`, {
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
      assert.ok(json.data.number.startsWith('QT-'));
      assert.equal(json.data.customerId, customer1Record.customer.id);
      assert.equal(json.data.subtotalPaise, 200000);
      assert.equal(json.data.discountPaise, 10000);
      assert.equal(json.data.taxPaise, 18000);
      assert.equal(json.data.totalPaise, 208000); // 200000 - 10000 + 18000
      assert.equal(json.data.status, 'draft');
      assert.equal(json.data.items.length, 1);
      createdQuotation = json.data;
    });

    test('Staff can list quotations with pagination and search', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/quotations?search=Alpha`, {
        headers: { Authorization: `Bearer ${staffToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(Array.isArray(json.data.data));
      assert.ok(json.data.data.some((q) => q.id === createdQuotation.id));
    });

    test('Admin/Staff can transition draft quotation to sent (POST /api/quotations/:id/send)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/quotations/${createdQuotation.id}/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.status, 'sent');
    });

    test('Customer 1 can view their own sent quotation', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/quotations/${createdQuotation.id}`, {
        headers: { Authorization: `Bearer ${customer1Token}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.id, createdQuotation.id);
    });

    test('Customer 2 CANNOT view Customer 1 quotation (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/quotations/${createdQuotation.id}`, {
        headers: { Authorization: `Bearer ${customer2Token}` }
      });

      assert.equal(res.status, 403);
    });

    test('Customer 1 can accept their own sent quotation (POST /api/quotations/:id/accept)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/quotations/${createdQuotation.id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${customer1Token}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.status, 'accepted');
    });

    test('Customer role CANNOT create quotations (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/quotations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customer1Token}`
        },
        body: JSON.stringify({
          customerId: customer1Record.customer.id,
          validUntil: '2026-12-31',
          items: [{ productId: baseProduct.id, description: 'Test', unitPricePaise: 1000 }]
        })
      });

      assert.equal(res.status, 403);
    });
  });

  // =========================================================================
  // MODULE C: PAYMENTS
  // =========================================================================
  describe('Module C — Payment Management', () => {
    let createdPayment;

    test('Admin/Staff can record a payment transaction', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const refNumber = `UPI-${uid()}`;
      const payload = {
        customerId: customer1Record.customer.id,
        amountPaise: 50000,
        method: 'upi',
        reference: refNumber,
        notes: 'Advance invoice payment'
      };

      const res = await fetch(`${baseUrl}/api/payments`, {
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
      assert.equal(json.data.customerId, customer1Record.customer.id);
      assert.equal(json.data.amountPaise, 50000);
      assert.equal(json.data.amountInPaise, 50000);
      assert.equal(json.data.method, 'upi');
      assert.equal(json.data.reference, refNumber);
      createdPayment = json.data;
    });

    test('Rejects duplicate payment reference for same customer (409 Conflict)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const payload = {
        customerId: customer1Record.customer.id,
        amountPaise: 50000,
        method: 'upi',
        reference: createdPayment.reference
      };

      const res = await fetch(`${baseUrl}/api/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`
        },
        body: JSON.stringify(payload)
      });

      assert.equal(res.status, 409);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.ok(json.message);
    });

    test('Staff can list payments and view statistics', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const [listRes, statsRes] = await Promise.all([
        fetch(`${baseUrl}/api/payments?customerId=${customer1Record.customer.id}`, {
          headers: { Authorization: `Bearer ${staffToken}` }
        }),
        fetch(`${baseUrl}/api/payments/stats`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      ]);

      assert.equal(listRes.status, 200);
      const listJson = await listRes.json();
      assert.ok(listJson.data.data.length >= 1);

      assert.equal(statsRes.status, 200);
      const statsJson = await statsRes.json();
      assert.ok(statsJson.data.totalCount >= 1);
      assert.ok(statsJson.data.totalAmountPaise >= 50000);
    });

    test('Customer 1 can view their own payment record', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/payments/${createdPayment.id}`, {
        headers: { Authorization: `Bearer ${customer1Token}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.id, createdPayment.id);
    });

    test('Customer 2 CANNOT view Customer 1 payment (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/payments/${createdPayment.id}`, {
        headers: { Authorization: `Bearer ${customer2Token}` }
      });

      assert.equal(res.status, 403);
    });

    test('Customer role CANNOT record payments (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customer1Token}`
        },
        body: JSON.stringify({
          customerId: customer1Record.customer.id,
          amountPaise: 1000,
          method: 'cash'
        })
      });

      assert.equal(res.status, 403);
    });
  });

  // =========================================================================
  // MODULE D: CUSTOMER PORTAL
  // =========================================================================
  describe('Module D — Customer Portal APIs', () => {
    test('Customer 1 can view their own portal profile (GET /api/portal/profile)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/portal/profile`, {
        headers: { Authorization: `Bearer ${customer1Token}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.email, customer1Record.email);
      assert.equal(json.data.company, 'Alpha Corp');
    });

    test('Customer 1 can update permitted profile fields (PUT /api/portal/profile)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/portal/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customer1Token}`
        },
        body: JSON.stringify({
          billingCity: 'Bengaluru',
          billingStateCode: 'KA',
          gstin: '29ABCDE1234F1Z5'
        })
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.billingCity, 'Bengaluru');
      assert.equal(json.data.gstin, '29ABCDE1234F1Z5');
    });

    test('Customer 1 can view their portal summary (GET /api/portal/summary)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/portal/summary`, {
        headers: { Authorization: `Bearer ${customer1Token}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.customer);
      assert.equal(json.data.customer.id, customer1Record.customer.id);
      assert.ok('activeSubscriptionsCount' in json.data);
      assert.ok('unpaidInvoicesCount' in json.data);
      assert.ok('totalOutstandingPaise' in json.data);
      assert.ok(Array.isArray(json.data.recentInvoices));
      assert.ok(Array.isArray(json.data.recentPayments));
    });

    test('Customer 1 can view their own quotations via portal (GET /api/portal/quotations)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/portal/quotations`, {
        headers: { Authorization: `Bearer ${customer1Token}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(Array.isArray(json.data.data));
    });

    test('Customer 1 can browse available subscription plans (GET /api/portal/plans)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/portal/plans`, {
        headers: { Authorization: `Bearer ${customer1Token}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(Array.isArray(json.data.data));
    });

    test('Unauthenticated portal requests are rejected (401 Unauthorized)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/portal/profile`);
      assert.equal(res.status, 401);
    });

    test('User without customer account is rejected from customer portal (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      // Admin user does not have a customer record
      const res = await fetch(`${baseUrl}/api/portal/profile`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 403);
    });
  });
});
