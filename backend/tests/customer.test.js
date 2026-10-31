import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { checkDatabaseHealth, query, closeDatabase } from '../src/database/index.js';
import { authService } from '../src/modules/auth/auth.service.js';
import { customerService } from '../src/modules/customer/customer.service.js';
import auth, { setFirebaseAuth, resetFirebaseAuth, MockFirebaseAuth } from '../src/config/firebase.js';

describe('Brightloop Billing - Customer CRUD Integration Suite', () => {
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

  let mockAuthInstance;

  before(async () => {
    mockAuthInstance = new MockFirebaseAuth();
    setFirebaseAuth(mockAuthInstance);

    app = createApp();

    const health = await checkDatabaseHealth();
    isDbConnected = health.alive;

    if (!isDbConnected) {
      console.log(`[Integration Test] PostgreSQL not connected (${health.error || 'DATABASE_URL not set'}).`);
      return;
    }

    // Clean test state for idempotent test runs
    await query('DELETE FROM customers; DELETE FROM users;');

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
      email: 'admin.cust@brightloop.io',
      password: 'AdminPassword123!',
      name: 'Admin Cust Test'
    });
    adminToken = auth.createMockToken(adminUser.firebaseUid, adminUser.email, adminUser.name);

    // 2. Seed Staff
    staffUser = await authService.createStaffAccount(
      {
        email: 'staff.cust@brightloop.io',
        password: 'StaffPassword123!',
        name: 'Staff Cust Test',
        role: 'staff'
      },
      adminUser
    );
    staffToken = auth.createMockToken(staffUser.firebaseUid, staffUser.email, staffUser.name);

    // 3. Seed Customer 1
    const cust1 = await authService.registerCustomer({
      email: 'customer1@alpha.com',
      password: 'CustPassword123!',
      name: 'Alpha Customer',
      companyName: 'Alpha Corp',
      phone: '+91 9999911111',
      billingAddress: 'Alpha Street, Bangalore'
    });
    customer1Record = cust1;
    customer1Token = auth.createMockToken(cust1.firebaseUid, cust1.email, cust1.name);

    // 4. Seed Customer 2
    const cust2 = await authService.registerCustomer({
      email: 'customer2@beta.com',
      password: 'CustPassword123!',
      name: 'Beta Customer',
      companyName: 'Beta Industries',
      phone: '+91 9999922222',
      billingAddress: 'Beta Avenue, Mumbai'
    });
    customer2Record = cust2;
    customer2Token = auth.createMockToken(cust2.firebaseUid, cust2.email, cust2.name);
  });

  after(async () => {
    resetFirebaseAuth();
    if (server) server.close();
    await closeDatabase();
  });

  // =========================================================================
  // 1. LIST CUSTOMERS (GET /api/customers)
  // =========================================================================
  describe('1. List Customers (GET /api/customers)', () => {
    test('Admin can list customers with pagination and metadata', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/customers?page=1&limit=10`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(Array.isArray(json.data.data));
      assert.ok(json.data.pagination);
      assert.equal(json.data.pagination.page, 1);
      assert.equal(json.data.pagination.pageSize, 10);
      assert.ok(json.data.pagination.total >= 2);
    });

    test('Staff can list customers', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/customers`, {
        headers: { Authorization: `Bearer ${staffToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.data.length >= 2);
    });

    test('Customer CANNOT list all customers (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/customers`, {
        headers: { Authorization: `Bearer ${customer1Token}` }
      });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.match(json.message, /Access forbidden|lacks permission/i);
    });

    test('Search filter matches company name, customer name, and email', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/customers?search=Alpha`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.data.some((c) => c.companyName === 'Alpha Corp'));
      assert.ok(!json.data.data.some((c) => c.companyName === 'Beta Industries'));
    });

    test('Status filter returns only matching status', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/customers?status=active`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.data.every((c) => c.status === 'active'));
    });

    test('Rejects invalid pagination parameters (e.g. page=0 or limit=-5)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/customers?page=0`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
    });
  });

  // =========================================================================
  // 2. GET CUSTOMER BY ID (GET /api/customers/:id)
  // =========================================================================
  describe('2. Get Customer By ID (GET /api/customers/:id)', () => {
    test('Admin can view any customer profile', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const cust1Id = customer1Record.customer.id;
      const res = await fetch(`${baseUrl}/api/customers/${cust1Id}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.id, cust1Id);
      assert.equal(json.data.companyName, 'Alpha Corp');
      assert.equal(json.data.email, 'customer1@alpha.com');
    });

    test('Staff can view any customer profile', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const cust2Id = customer2Record.customer.id;
      const res = await fetch(`${baseUrl}/api/customers/${cust2Id}`, {
        headers: { Authorization: `Bearer ${staffToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.id, cust2Id);
      assert.equal(json.data.companyName, 'Beta Industries');
    });

    test('Customer can view their OWN profile', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const cust1Id = customer1Record.customer.id;
      const res = await fetch(`${baseUrl}/api/customers/${cust1Id}`, {
        headers: { Authorization: `Bearer ${customer1Token}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.id, cust1Id);
    });

    test('Customer CANNOT view another customer profile (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const cust2Id = customer2Record.customer.id;
      const res = await fetch(`${baseUrl}/api/customers/${cust2Id}`, {
        headers: { Authorization: `Bearer ${customer1Token}` }
      });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.match(json.message, /Customers are strictly permitted to access only their own/i);
    });

    test('Returns 404 Not Found for non-existent customer ID', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await fetch(`${baseUrl}/api/customers/${nonExistentId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 404);
      const json = await res.json();
      assert.equal(json.success, false);
    });
  });

  // =========================================================================
  // 3. CREATE CUSTOMER (POST /api/customers)
  // =========================================================================
  describe('3. Create Customer (POST /api/customers)', () => {
    let createdCustomer;

    test('Admin/Staff can create a new customer account', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const newCustomerPayload = {
        name: 'Gamma Innovations',
        email: 'billing@gamma.io',
        password: 'Password123!',
        companyName: 'Gamma Global Ltd',
        phone: '+91 9876543210',
        billingAddress: '456 Tech Park, Hyderabad',
        creditLimitPaise: 2500000
      };

      const res = await fetch(`${baseUrl}/api/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`
        },
        body: JSON.stringify(newCustomerPayload)
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.name, newCustomerPayload.name);
      assert.equal(json.data.email, newCustomerPayload.email);
      assert.equal(json.data.companyName, newCustomerPayload.companyName);
      assert.equal(json.data.creditLimitPaise, 2500000);
      assert.equal(json.data.role, 'customer');
      assert.equal(json.data.status, 'active');
      assert.ok(json.data.id);
      assert.ok(json.data.userId);

      createdCustomer = json.data;
    });

    test('Client cannot supply or elevate role during creation (role is forced to customer)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const spoofRolePayload = {
        name: 'Malicious Elevate Attempt',
        email: 'spoof@attacker.io',
        password: 'Password123!',
        companyName: 'Evil Corp',
        role: 'admin' // Attempting to inject admin role
      };

      const res = await fetch(`${baseUrl}/api/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(spoofRolePayload)
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.data.role, 'customer', 'Role must strictly be set to customer server-side');
    });

    test('Customer role CANNOT create new customers (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customer1Token}`
        },
        body: JSON.stringify({
          name: 'Forbidden Customer',
          email: 'forbidden@test.io',
          password: 'Password123!'
        })
      });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.success, false);
    });

    test('Rejects creation when email is duplicate (409 Conflict)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Duplicate Email Test',
          email: 'billing@gamma.io', // Already created
          password: 'Password123!'
        })
      });

      assert.equal(res.status, 409);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.match(json.message, /already exists/i);
    });

    test('Rejects weak password during creation', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Weak Pass Customer',
          email: 'weakpass@test.io',
          password: 'short' // Lacks length, uppercase, special char
        })
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
    });
  });

  // =========================================================================
  // 4. UPDATE CUSTOMER (PUT /api/customers/:id)
  // =========================================================================
  describe('4. Update Customer (PUT /api/customers/:id)', () => {
    test('Customer can update permitted fields on their own profile', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const cust1Id = customer1Record.customer.id;
      const res = await fetch(`${baseUrl}/api/customers/${cust1Id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customer1Token}`
        },
        body: JSON.stringify({
          name: 'Alpha Customer Renamed',
          companyName: 'Alpha Corp Global',
          phone: '+91 8888899999',
          billingAddress: 'New Alpha Boulevard'
        })
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.name, 'Alpha Customer Renamed');
      assert.equal(json.data.companyName, 'Alpha Corp Global');
      assert.equal(json.data.phone, '+91 8888899999');
      assert.equal(json.data.billingAddress, 'New Alpha Boulevard');
    });

    test('Customer CANNOT update another customer profile (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const cust2Id = customer2Record.customer.id;
      const res = await fetch(`${baseUrl}/api/customers/${cust2Id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customer1Token}`
        },
        body: JSON.stringify({
          name: 'Malicious Update'
        })
      });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.success, false);
    });

    test('Admin/Staff can update customer details', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const cust2Id = customer2Record.customer.id;
      const res = await fetch(`${baseUrl}/api/customers/${cust2Id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`
        },
        body: JSON.stringify({
          companyName: 'Beta Industries Updated by Staff'
        })
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.companyName, 'Beta Industries Updated by Staff');
    });

    test('Customer cannot manipulate credit limit or balance via PUT update endpoint', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const cust1Id = customer1Record.customer.id;
      const beforeRes = await fetch(`${baseUrl}/api/customers/${cust1Id}`, {
        headers: { Authorization: `Bearer ${customer1Token}` }
      });
      const beforeData = (await beforeRes.json()).data;

      // Customer attempts to self-grant credit limit or balance
      const res = await fetch(`${baseUrl}/api/customers/${cust1Id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customer1Token}`
        },
        body: JSON.stringify({
          companyName: 'Alpha Corp Legitimate Update',
          creditLimitPaise: 999999999,
          accountBalancePaise: 999999999
        })
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.data.creditLimitPaise, beforeData.creditLimitPaise);
      assert.equal(json.data.accountBalancePaise, beforeData.accountBalancePaise);
    });
  });

  // =========================================================================
  // 5. UPDATE CREDIT LIMIT (PATCH /api/customers/:id/credit-limit)
  // =========================================================================
  describe('5. Update Credit Limit (PATCH /api/customers/:id/credit-limit)', () => {
    test('Admin can update customer credit limit', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const cust1Id = customer1Record.customer.id;
      const res = await fetch(`${baseUrl}/api/customers/${cust1Id}/credit-limit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          creditLimitPaise: 5000000 // 50,000 INR
        })
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.creditLimitPaise, 5000000);
    });

    test('Staff CANNOT update credit limit (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const cust1Id = customer1Record.customer.id;
      const res = await fetch(`${baseUrl}/api/customers/${cust1Id}/credit-limit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`
        },
        body: JSON.stringify({ creditLimitPaise: 1000000 })
      });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.success, false);
    });

    test('Customer CANNOT update credit limit (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const cust1Id = customer1Record.customer.id;
      const res = await fetch(`${baseUrl}/api/customers/${cust1Id}/credit-limit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customer1Token}`
        },
        body: JSON.stringify({ creditLimitPaise: 1000000 })
      });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.success, false);
    });

    test('Rejects negative or non-integer credit limit amounts', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const cust1Id = customer1Record.customer.id;
      const res = await fetch(`${baseUrl}/api/customers/${cust1Id}/credit-limit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ creditLimitPaise: -100 })
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
    });
  });

  // =========================================================================
  // 6. UPDATE STATUS (PATCH /api/customers/:id/status)
  // =========================================================================
  describe('6. Update Customer Status (PATCH /api/customers/:id/status)', () => {
    test('Admin can change customer status to suspended and active', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const cust2Id = customer2Record.customer.id;

      // Suspend
      const suspendRes = await fetch(`${baseUrl}/api/customers/${cust2Id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: 'suspended' })
      });

      assert.equal(suspendRes.status, 200);
      const suspendJson = await suspendRes.json();
      assert.equal(suspendJson.data.status, 'suspended');

      // Reactivate
      const activeRes = await fetch(`${baseUrl}/api/customers/${cust2Id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: 'active' })
      });

      assert.equal(activeRes.status, 200);
      const activeJson = await activeRes.json();
      assert.equal(activeJson.data.status, 'active');
    });

    test('Staff CANNOT change customer status (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const cust2Id = customer2Record.customer.id;
      const res = await fetch(`${baseUrl}/api/customers/${cust2Id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`
        },
        body: JSON.stringify({ status: 'inactive' })
      });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.success, false);
    });

    test('Customer CANNOT change status (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const cust1Id = customer1Record.customer.id;
      const res = await fetch(`${baseUrl}/api/customers/${cust1Id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customer1Token}`
        },
        body: JSON.stringify({ status: 'inactive' })
      });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.success, false);
    });

    test('Rejects invalid status string (400 Bad Request)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const cust1Id = customer1Record.customer.id;
      const res = await fetch(`${baseUrl}/api/customers/${cust1Id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: 'deleted_invalid' })
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
    });
  });

  // =========================================================================
  // 7. SAFE DEACTIVATION / ARCHIVE (DELETE /api/customers/:id)
  // =========================================================================
  describe('7. Safe Deactivation (DELETE /api/customers/:id)', () => {
    test('Admin can safely deactivate a customer account', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const cust2Id = customer2Record.customer.id;
      const res = await fetch(`${baseUrl}/api/customers/${cust2Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.deactivated, true);
      assert.equal(json.data.status, 'inactive');

      // Verify the status in database is now 'inactive'
      const checkRes = await fetch(`${baseUrl}/api/customers/${cust2Id}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const checkJson = await checkRes.json();
      assert.equal(checkJson.data.status, 'inactive');
    });

    test('Staff CANNOT delete or deactivate customer (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const cust1Id = customer1Record.customer.id;
      const res = await fetch(`${baseUrl}/api/customers/${cust1Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${staffToken}` }
      });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.success, false);
    });

    test('Customer CANNOT delete own or another customer account (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const cust1Id = customer1Record.customer.id;
      const res = await fetch(`${baseUrl}/api/customers/${cust1Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${customer1Token}` }
      });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.success, false);
    });
  });

  // =========================================================================
  // 8. DATABASE TRANSACTION FAILURE CLEANUP
  // =========================================================================
  describe('8. Database Failures Do Not Leave Orphan Firebase Accounts', () => {
    test('Rolls back created Firebase account if SQL transaction throws', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      let cleanedUpUid = null;
      const originalDeleteUser = mockAuthInstance.deleteUser.bind(mockAuthInstance);
      mockAuthInstance.deleteUser = async (uid) => {
        cleanedUpUid = uid;
        return originalDeleteUser(uid);
      };

      // Temporarily bypass checkEmailAvailability to simulate race condition where DB hits unique constraint
      const originalCheck = customerService.checkEmailAvailability;
      customerService.checkEmailAvailability = async () => true;

      // Pre-insert a user with email 'orphan.test@brightloop.io' in PostgreSQL
      await query(
        `INSERT INTO users (id, firebase_uid, email, name, role, status)
         VALUES ('pre-existing-id', 'pre-existing-fb-uid', 'orphan.test@brightloop.io', 'Existing User', 'customer', 'active')`
      );

      try {
        await assert.rejects(
          async () => {
            await customerService.createCustomer({
              email: 'orphan.test@brightloop.io',
              password: 'Password123!',
              name: 'Orphan Rollback Test User'
            });
          },
          /unique|duplicate/i
        );

        // Assert that deleteUser was invoked on the created Firebase user
        assert.ok(cleanedUpUid, 'Firebase deleteUser must be called when DB insert fails');
      } finally {
        customerService.checkEmailAvailability = originalCheck;
        mockAuthInstance.deleteUser = originalDeleteUser;
      }
    });
  });
});
