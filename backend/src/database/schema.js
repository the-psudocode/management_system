import { getPool } from './connection.js';

/**
 * PostgreSQL Database Initialization Script.
 *
 * Requirements:
 * 3. Database initialization logic compatible with PostgreSQL.
 * 4. PostgreSQL-compatible SQL syntax and data types (TIMESTAMPTZ, VARCHAR, TEXT, UUID).
 * 5. Enable foreign-key relationships through PostgreSQL constraints.
 * 6. Use BIGINT for monetary values stored in paise (1 INR = 100 paise).
 * 9. Appropriate indexes for efficient lookups and joins.
 */
export const initDatabase = async (clientOrPool = getPool()) => {
  const ddlStatements = `
    -- Enable pgcrypto for gen_random_uuid() if supported
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    -- Users Table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      firebase_uid VARCHAR(128) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL CHECK (role IN ('admin', 'staff', 'customer')),
      status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Customers Table (Foreign-key relationship to users)
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      company_name VARCHAR(255),
      phone VARCHAR(50),
      billing_address TEXT,
      account_balance_paise BIGINT NOT NULL DEFAULT 0,
      credit_limit_paise BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT fk_customers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Products Table
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Product Variants Table (Foreign key to products, monetary price in BIGINT paise)
    CREATE TABLE IF NOT EXISTS product_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      sku VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      price_paise BIGINT NOT NULL CHECK (price_paise >= 0),
      currency VARCHAR(3) NOT NULL DEFAULT 'INR',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT fk_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    -- Subscription Plans Table (Foreign key to products, recurring amount in BIGINT paise)
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      name VARCHAR(255) NOT NULL,
      billing_interval VARCHAR(32) NOT NULL CHECK (billing_interval IN ('monthly', 'quarterly', 'yearly', 'weekly')),
      interval_count INT NOT NULL DEFAULT 1 CHECK (interval_count > 0),
      amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
      currency VARCHAR(3) NOT NULL DEFAULT 'INR',
      status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT fk_plans_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    -- Performance Indexes (Requirement 9)
    CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
    CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
    CREATE INDEX IF NOT EXISTS idx_subscription_plans_product_id ON subscription_plans(product_id);
  `;

  try {
    await clientOrPool.query(ddlStatements);
    return true;
  } catch (error) {
    console.error('[PostgreSQL Schema Init Error]', error.message);
    throw error;
  }
};

export default initDatabase;

