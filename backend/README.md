# Brightloop Billing — Backend Engine

Robust billing engine and subscription management backend for Brightloop Software, built with **Node.js**, **Express**, **PostgreSQL**, and **Firebase Authentication**.

---

## Technical Architecture

### 1. Database Foundation: PostgreSQL & `pg.Pool`
- **Driver**: Node.js `pg` package (`pg.Pool`).
- **Configuration**: Environment-based `DATABASE_URL` configuration (`postgresql://user:pass@host:port/dbname`).
- **Connection Pooling**: Managed singleton pool with configurable `max` clients (default: 20), idle timeout (`30000ms`), and connection acquisition timeout (`5000ms`).
- **Transaction Safety**: All multi-step operations execute inside `withTransaction()` utilizing atomic `BEGIN`, `COMMIT`, and `ROLLBACK` blocks.
- **SQL Security**: Exclusively parameterized SQL queries (`$1, $2, ...`) preventing SQL injection.
- **Monetary Storage Standard**: All monetary values are strictly stored as `BIGINT` in **paise** (1 INR = 100 paise) to eliminate floating-point rounding errors.

### 2. Relational Schema & Indexes
- **`users`**: Central authentication identity table with strict role constraints (`admin`, `staff`, `customer`) and active status checks.
- **`customers`**: Linked via foreign key constraint `ON DELETE CASCADE` to `users(id)`. Stores customer metadata and balances (`account_balance_paise BIGINT`, `credit_limit_paise BIGINT`).
- **`products`**: Catalog products with lifecycle statuses.
- **`product_variants`**: Product variants referencing `products(id)` with monetary `price_paise BIGINT`.
- **`subscription_plans`**: Recurring subscription plans referencing `products(id)` with `amount_paise BIGINT` and billing cadence.
- **Performance Indexes**:
  - `idx_users_firebase_uid`
  - `idx_users_email` (case-insensitive on `LOWER(email)`)
  - `idx_users_role`
  - `idx_customers_user_id`
  - `idx_product_variants_product_id`
  - `idx_subscription_plans_product_id`

---

## Environment Configuration

Create a `.env` file in the backend directory (see `.env.example`):

```bash
PORT=5000
NODE_ENV=development

# PostgreSQL Connection Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/brightloop_billing
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000
DB_POOL_CONN_TIMEOUT=5000
DB_SSL=false

CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# Firebase Authentication (Optional in offline/mock mode)
FIREBASE_SERVICE_ACCOUNT_PATH=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Offline mock auth mode (runs tests without live Google credentials)
MOCK_AUTH=false
```

---

## Scripts & Operations

```bash
# Install dependencies
npm install

# Start server in production mode
npm start

# Start server in development mode (with watch)
npm run dev

# Run automated test suite
npm test

# Verify PostgreSQL connection using environment variables
npm run db:verify
```

---

## Health Check & Monitoring

The server exposes a centralized health check at `GET /api/health`:
- Verifies pool connectivity (`SELECT 1 AS is_alive, NOW() AS server_time, current_database() AS database_name`).
- Reports active, idle, and waiting client counts in the PostgreSQL connection pool.
- Returns `200 OK` when healthy, or `503 Service Unavailable` with diagnostic details when disconnected.

