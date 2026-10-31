import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { checkDatabaseHealth, query, closeDatabase } from '../src/database/index.js';
import { authService } from '../src/modules/auth/auth.service.js';
import auth, { setFirebaseAuth, resetFirebaseAuth, MockFirebaseAuth } from '../src/config/firebase.js';
import { cleanDatabase } from './helpers.js';

describe('Brightloop Billing - Authentication & Authorization Live Integration Suite', () => {
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
  let customer1User;
  let customer2User;

  before(async () => {
    // For automated integration tests simulating Bearer tokens, attach mock auth provider
    const mockAuth = new MockFirebaseAuth();
    setFirebaseAuth(mockAuth);

    app = createApp();

    const health = await checkDatabaseHealth();
    isDbConnected = health.alive;

    if (!isDbConnected) {
      console.log(`[Integration Test] PostgreSQL not connected (${health.error || 'DATABASE_URL not set'}).`);
      console.log('[Integration Test] Live endpoint tests will be skipped. Run "npm run db:verify" with a valid DATABASE_URL to verify live connections.');
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

    // Seed Root Administrator for testing
    adminUser = await authService.seedAdminIfNotExists({
      email: 'admin@brightloop.io',
      password: 'AdminPassword123!',
      name: 'Brightloop Master Admin'
    });
    adminToken = auth.createMockToken(adminUser.firebaseUid, adminUser.email, adminUser.name);
  });

  after(async () => {
    resetFirebaseAuth();
    if (server) server.close();
    await closeDatabase();
  });

  describe('1. Public Customer Registration (POST /api/auth/register)', () => {
    test('Requirement 4 & 7: Successfully registers customer with valid data and strong password', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const payload = {
        email: 'customer1@acme.corp',
        password: 'SecurePassword123!',
        name: 'Alice Customer',
        companyName: 'Acme Corp',
        phone: '+1-555-0100'
      };

      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      assert.equal(res.status, 201);
      assert.equal(data.success, true);
      assert.equal(data.data.email, 'customer1@acme.corp');
      assert.equal(data.data.role, 'customer');
      assert.equal(data.data.customer.companyName, 'Acme Corp');

      customer1User = data.data;
      customer1Token = auth.createMockToken(customer1User.firebaseUid, customer1User.email, customer1User.name);

      // Verify record stored in PostgreSQL
      const row = await query('SELECT role FROM users WHERE email = $1', ['customer1@acme.corp']);
      assert.equal(row.rows[0].role, 'customer');
    });

    test('Requirement 9: Client cannot elevate role during registration (frontend roles ignored)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const payload = {
        email: 'attacker@evil.com',
        password: 'StrongPassword999!',
        name: 'Hacker Joe',
        role: 'admin'
      };

      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      assert.equal(res.status, 201);
      assert.equal(data.data.role, 'customer');

      const row = await query('SELECT role FROM users WHERE email = $1', ['attacker@evil.com']);
      assert.equal(row.rows[0].role, 'customer');
    });

    test('Requirement 6: Fails when email is duplicate (Email uniqueness)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const payload = {
        email: 'customer1@acme.corp',
        password: 'AnotherPassword123!',
        name: 'Duplicate Alice'
      };

      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      assert.equal(res.status, 409);
      assert.equal(data.success, false);
      assert.match(data.message, /already exists/i);
    });

    test('Requirement 7: Fails when password is 8 characters or less', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const payload = {
        email: 'shortpass@example.com',
        password: 'Abc!123',
        name: 'Short Pass'
      };

      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      assert.equal(res.status, 400);
      assert.equal(data.success, false);
      assert.match(data.message, /Validation Error/);
    });

    test('Requirement 7: Fails when password lacks uppercase letter', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const payload = {
        email: 'nouppercase@example.com',
        password: 'lowercase123!@#',
        name: 'No Upper'
      };

      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      assert.equal(res.status, 400);
      assert.match(data.details[0].message, /uppercase/i);
    });

    test('Requirement 7: Fails when password lacks special character', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const payload = {
        email: 'nospecial@example.com',
        password: 'Uppercase12345678',
        name: 'No Special'
      };

      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      assert.equal(res.status, 400);
      assert.match(data.details[0].message, /special/i);
    });
  });

  describe('2. Staff Account Creation (POST /api/auth/staff)', () => {
    test('Requirement 5: Fails when request is unauthenticated', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/auth/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'staff1@brightloop.io',
          password: 'StaffPassword123!',
          name: 'Bob Staff'
        })
      });

      assert.equal(res.status, 401);
    });

    test('Requirement 5: Fails when called by a Customer role (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/auth/staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customer1Token}`
        },
        body: JSON.stringify({
          email: 'staff2@brightloop.io',
          password: 'StaffPassword123!',
          name: 'Bob Staff'
        })
      });

      assert.equal(res.status, 403);
    });

    test('Requirement 5: Successfully creates staff account when called by Admin', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/auth/staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          email: 'staff.operations@brightloop.io',
          password: 'StaffPassword123!',
          name: 'Sarah Operations',
          role: 'staff'
        })
      });

      const data = await res.json();
      assert.equal(res.status, 201);
      assert.equal(data.success, true);
      assert.equal(data.data.role, 'staff');

      staffUser = data.data;
      staffToken = auth.createMockToken(staffUser.firebaseUid, staffUser.email, staffUser.name);

      const dbRow = await query('SELECT role FROM users WHERE email = $1', ['staff.operations@brightloop.io']);
      assert.equal(dbRow.rows[0].role, 'staff');
    });

    test('Requirement 5: Staff cannot create other staff accounts (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/auth/staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`
        },
        body: JSON.stringify({
          email: 'anotherstaff@brightloop.io',
          password: 'StaffPassword123!',
          name: 'Another Staff'
        })
      });

      assert.equal(res.status, 403);
    });
  });

  describe('3. Token Verification & Role Retrieval from PostgreSQL (GET /api/auth/me)', () => {
    test('Requirement 1: Rejects missing token with 401 Unauthorized', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/auth/me`);
      assert.equal(res.status, 401);
    });

    test('Requirement 1: Rejects invalid token with 401 Unauthorized', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: 'Bearer totally_invalid_token' }
      });
      assert.equal(res.status, 401);
    });

    test('Requirement 2: Retrieves user profile and role from PostgreSQL for Admin', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.data.user.role, 'admin');
      assert.equal(data.data.user.email, 'admin@brightloop.io');
    });

    test('Requirement 2: Retrieves user profile and role from PostgreSQL for Customer', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${customer1Token}` }
      });

      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.data.user.role, 'customer');
      assert.equal(data.data.user.customer.companyName, 'Acme Corp');
    });
  });

  describe('4. Record Access Isolation for Customers (Requirement 10)', () => {
    before(async () => {
      if (!isDbConnected) return;

      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'customer2@globex.corp',
          password: 'SecurePassword123!',
          name: 'Bob Globex',
          companyName: 'Globex Corp'
        })
      });
      const data = await res.json();
      customer2User = data.data;
      customer2Token = auth.createMockToken(customer2User.firebaseUid, customer2User.email, customer2User.name);
    });

    test('Customer can access their own record (200 OK)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/auth/users/${customer1User.id}`, {
        headers: { Authorization: `Bearer ${customer1Token}` }
      });

      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.data.id, customer1User.id);
      assert.equal(data.data.email, 'customer1@acme.corp');
    });

    test('Customer CANNOT access another customer record (403 Forbidden)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/auth/users/${customer2User.id}`, {
        headers: { Authorization: `Bearer ${customer1Token}` }
      });

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.match(data.message, /strictly permitted to access only their own records/i);
    });

    test('Staff CAN access customer record (200 OK)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/auth/users/${customer1User.id}`, {
        headers: { Authorization: `Bearer ${staffToken}` }
      });

      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.data.id, customer1User.id);
    });

    test('Admin CAN access any customer record (200 OK)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/auth/users/${customer1User.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.data.id, customer1User.id);
    });
  });

  describe('5. Password Reset through Firebase Authentication (POST /api/auth/password-reset)', () => {
    test('Requirement 11: Generates reset link for existing user', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/auth/password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'customer1@acme.corp' })
      });

      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.success, true);
      assert.equal(data.data.email, 'customer1@acme.corp');
      assert.ok(data.data.resetLink);
    });

    test('Requirement 11: Fails when email is not registered (404 Not Found)', async (t) => {
      if (!isDbConnected) return t.skip('Requires active PostgreSQL connection');

      const res = await fetch(`${baseUrl}/api/auth/password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'unknown@example.com' })
      });

      const data = await res.json();
      assert.equal(res.status, 404);
      assert.equal(data.success, false);
    });
  });
});
