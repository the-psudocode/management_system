import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadPortalOverview } from '../src/modules/portal/routes.js';
import { requireRole } from '../src/middleware/authorize.js';

describe('customer portal access isolation', () => {
  it('resolves all portal records through the authenticated user’s customer id', async () => {
    const calls = { customerIds: [], subscriptions: [], invoices: [], quotations: [], payments: [] };
    const db = {
      customer: { findUnique: async (args) => {
        calls.customerIds.push(args.where.userId);
        const customerId = args.where.userId === 'user-a' ? 'customer-a' : 'customer-b';
        return {
          id: customerId, userId: args.where.userId, companyName: 'Example Co',
          phone: null, billingAddress: null, accountBalancePaise: 0n, creditLimitPaise: 0n,
          createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z'),
          user: { id: args.where.userId, name: 'Customer A', email: 'a@example.test', status: 'active' },
        };
      } },
      subscription: { findMany: async (args) => { calls.subscriptions.push(args.where.customerId); return []; } },
      invoice: { findMany: async (args) => { calls.invoices.push(args.where.customerId); return []; } },
      quotation: { findMany: async (args) => { calls.quotations.push(args.where.customerId); return []; } },
      payment: { findMany: async (args) => { calls.payments.push(args.where.customerId); return []; } },
    };

    const result = await loadPortalOverview(db, 'user-a');
    const otherResult = await loadPortalOverview(db, 'user-b');

    assert.deepEqual(calls.customerIds, ['user-a', 'user-b']);
    for (const key of ['subscriptions', 'invoices', 'quotations', 'payments']) {
      assert.deepEqual(calls[key], ['customer-a', 'customer-b']);
      assert.deepEqual(result[key], []);
      assert.deepEqual(otherResult[key], []);
    }
    assert.equal(result.customer.name, 'Customer A');
  });

  it('rejects access when the authenticated user has no linked customer', async () => {
    const db = { customer: { findUnique: async () => null } };
    await assert.rejects(loadPortalOverview(db, 'user-without-customer'), /Customer account not found/);
  });

  it('allows customer role and denies other roles at the portal guard', () => {
    let allowed = false;
    requireRole('customer')({ user: { id: 'u1', role: 'customer' } }, {}, (error) => {
      assert.equal(error, undefined);
      allowed = true;
    });
    assert.equal(allowed, true);

    let denied;
    requireRole('customer')({ user: { id: 'u2', role: 'staff' } }, {}, (error) => { denied = error; });
    assert.equal(denied?.statusCode, 403);
  });
});
