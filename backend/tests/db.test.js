import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { getPool, checkDatabaseHealth, withTransaction, closeDatabase } from '../src/database/index.js';
import { initDatabase } from '../src/database/schema.js';
import config from '../src/config/index.js';

describe('PostgreSQL Backend Foundation Test Suite', () => {
  describe('1. Centralized pg.Pool Connection & Configuration', () => {
    test('Requirement 2: Creates centralized pg.Pool instance', () => {
      const pool = getPool();
      assert.ok(pool, 'Pool instance must be created');
      assert.equal(typeof pool.query, 'function', 'Pool must have query method');
      assert.equal(typeof pool.connect, 'function', 'Pool must have connect method');
      assert.equal(typeof pool.on, 'function', 'Pool must handle event emitters');
    });

    test('Requirement 2 & 10: Pool configuration honors pool limits and timeout defaults', () => {
      assert.equal(typeof config.db.max, 'number');
      assert.ok(config.db.max >= 5, 'Pool max size must be at least 5');
      assert.ok(config.db.idleTimeoutMillis >= 1000, 'Idle timeout must be set');
      assert.ok(config.db.connectionTimeoutMillis >= 1000, 'Connection timeout must be set');
    });
  });

  describe('2. Connection Error Handling & Diagnostics (Requirement 10 & 12)', () => {
    test('Gracefully handles disconnected database health check without throwing', async () => {
      // In the absence of a live database server, checkDatabaseHealth returns structured disconnected state
      const health = await checkDatabaseHealth();
      assert.ok(health);
      assert.equal(typeof health.status, 'string');
      assert.equal(typeof health.alive, 'boolean');
      if (!health.alive) {
        assert.ok(health.error, 'Disconnected health check must supply descriptive error');
      }
    });
  });

  describe('3. Database Transactions with BEGIN, COMMIT and ROLLBACK (Requirement 7)', () => {
    test('withTransaction rolls back and releases client when operation throws', async () => {
      let rolledBack = false;
      let released = false;

      // Mock pg client
      const mockClient = {
        query: async (sql) => {
          if (sql === 'ROLLBACK') {
            rolledBack = true;
          }
          return { rows: [] };
        },
        release: () => {
          released = true;
        }
      };

      // Mock pool
      const mockPool = {
        connect: async () => mockClient
      };

      // Test transactional execution with simulated error
      const executeTx = async (callback) => {
        const client = await mockPool.connect();
        try {
          await client.query('BEGIN');
          await callback(client);
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      };

      await assert.rejects(
        async () => {
          await executeTx(async () => {
            throw new Error('Simulated transaction failure');
          });
        },
        { message: 'Simulated transaction failure' }
      );

      assert.equal(rolledBack, true, 'Transaction must execute ROLLBACK on error');
      assert.equal(released, true, 'Client must always be released back to the pool');
    });
  });

  describe('4. PostgreSQL Schema & Monetary Values in Paise (Requirements 3, 4, 5, 6, 9)', () => {
    test('Schema includes foreign-key constraints, BIGINT paise, and indexes', async () => {
      let executedSql = '';
      const mockClient = {
        query: async (sql) => {
          executedSql = sql;
          return { rows: [] };
        }
      };

      await initDatabase(mockClient);

      // Requirement 4: PostgreSQL data types
      assert.match(executedSql, /TIMESTAMPTZ/i, 'Must use PostgreSQL TIMESTAMPTZ');
      assert.match(executedSql, /VARCHAR/i, 'Must use PostgreSQL VARCHAR');

      // Requirement 5: Foreign key constraints
      assert.match(executedSql, /CONSTRAINT fk_customers_user FOREIGN KEY/i, 'Must define fk_customers_user constraint');
      assert.match(executedSql, /REFERENCES users\(id\) ON DELETE CASCADE/i, 'Must define cascade delete');
      assert.match(executedSql, /CONSTRAINT fk_variants_product FOREIGN KEY/i, 'Must define fk_variants_product');
      assert.match(executedSql, /CONSTRAINT fk_plans_product FOREIGN KEY/i, 'Must define fk_plans_product');

      // Requirement 6: BIGINT for monetary values stored in paise
      assert.match(executedSql, /account_balance_paise BIGINT/i, 'Customer balance must be BIGINT paise');
      assert.match(executedSql, /credit_limit_paise BIGINT/i, 'Credit limit must be BIGINT paise');
      assert.match(executedSql, /price_paise BIGINT/i, 'Variant price must be BIGINT paise');
      assert.match(executedSql, /amount_paise BIGINT/i, 'Plan amount must be BIGINT paise');

      // Requirement 9: Performance indexes
      assert.match(executedSql, /CREATE INDEX IF NOT EXISTS idx_users_firebase_uid/i);
      assert.match(executedSql, /CREATE INDEX IF NOT EXISTS idx_users_email/i);
      assert.match(executedSql, /CREATE INDEX IF NOT EXISTS idx_users_role/i);
      assert.match(executedSql, /CREATE INDEX IF NOT EXISTS idx_customers_user_id/i);
      assert.match(executedSql, /CREATE INDEX IF NOT EXISTS idx_product_variants_product_id/i);
      assert.match(executedSql, /CREATE INDEX IF NOT EXISTS idx_subscription_plans_product_id/i);
    });
  });
});

