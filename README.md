# Brightloop Billing — Management System

A modern billing engine and subscription management platform built with React, Vite, Node.js, and Express backed by Neon PostgreSQL and Firebase Authentication.

---

## Project Structure

```text
management_system/
├── frontend/                  # React 19 + TypeScript + Vite + Tailwind CSS frontend
│   ├── src/
│   │   ├── components/        # Layout (Sidebar, Navbar), common widgets
│   │   ├── pages/             # Dashboard, Customers, Products, Subscriptions, Invoices, Auth
│   │   ├── services/          # API service layer
│   │   ├── data/              # Mock data store
│   │   ├── types/             # TypeScript data contracts & models
│   │   └── utils/             # Currency & date formatters
│   ├── package.json
│   └── vite.config.ts
├── backend/                   # Express.js + PostgreSQL (Neon) + Firebase Admin SDK backend
│   ├── src/
│   │   ├── config/            # Firebase & App configuration
│   │   ├── database/          # PostgreSQL connection pool & schema
│   │   ├── middleware/        # Authentication (Firebase) & RBAC authorization
│   │   ├── modules/           # Auth, Customer CRUD, Products, Plans, Quotations, Payments, Portal
│   │   └── utils/             # Standard response & error handlers
│   ├── tests/                 # Automated test suites
│   └── package.json
├── brightloop-billing/server/ # Developer 1 Billing & Subscription engine
│   ├── src/
│   │   ├── config/            # Environment & app config
│   │   ├── database/          # Prisma client with @prisma/adapter-neon
│   │   ├── middleware/        # Firebase auth, RBAC, error handling
│   │   ├── modules/           # Catalog, subscriptions, billing, quotations, payments, rules, analytics
│   │   └── jobs/              # Recurring billing scheduler
│   ├── prisma/                # schema.prisma & configuration
│   ├── test/                  # Automated unit and integration test suites
│   └── docs/                  # Backend architecture specification
└── package.json               # Monorepo root runner
```

---

## Quick Start

### 1. Frontend Setup
Run the frontend from the project root:
```bash
# Start frontend development server (http://localhost:5173)
npm run dev

# Build frontend for production
npm run build
```

Or directly inside the `frontend` folder:
```bash
cd frontend
npm install
npm run dev
npm run build
```

### 2. Backend Setup
Run the backend from the project root:
```bash
# Start backend server in development mode (http://localhost:5000)
npm run dev:backend

# Run backend test suite
npm run test:backend

# Verify PostgreSQL connection and schema
npm run verify:backend
```

Or navigate to `backend/`:
```bash
cd backend
npm install
npm run db:verify
npm test
npm run dev
```

For Developer 1's server (`brightloop-billing/server`):
```bash
cd brightloop-billing/server
npm install
npm run prisma:generate
npm test
```

### 3. Environment & Configuration

Copy `.env.example` to `.env` inside `backend/` and `brightloop-billing/server/` if not present.

Configure:
- `DATABASE_URL`: Pooled connection string for runtime queries (Neon PostgreSQL).
- `DATABASE_URL_UNPOOLED`: Direct connection string for Prisma / migrations.
- `FIREBASE_PROJECT_ID`: Firebase project identifier for token verification.
- `FIREBASE_SERVICE_ACCOUNT_PATH`: Path to Firebase Admin service account key JSON.
- `BUSINESS_STATE_CODE`: Business origin state code (e.g. `KA`) to calculate Indian GST.

### 4. API Endpoints

- Health check: `GET /` and `GET /api/health`
- Core Modules (`/api`):
  - Auth: `/api/auth/register`, `/api/auth/sync`, `/api/auth/me`
  - Customers: `/api/customers`, `/api/customers/:id`
  - Products & Variants: `/api/products`, `/api/products/:id/variants`
  - Subscription Plans: `/api/plans`, `/api/subscription-plans`
  - Quotations: `/api/quotations`, `/api/quotations/:id`
  - Payments: `/api/payments`, `/api/payments/:id`
  - Customer Portal: `/api/portal/profile`, `/api/portal/subscriptions`, `/api/portal/invoices`
- Billing & Invoicing Engine (`/api/v1`):
  - Catalog: `/customers`, `/products`, `/plans`
  - Subscriptions & Quotations: `/subscriptions`, `/quotations`, `/quotation-templates`
  - Billing & Invoicing: `/billing/preview`, `/billing/run`, `/invoices`
  - Payments: `/payments`
  - Rules & Taxes: `/tax-rules`, `/discounts`
  - Analytics: `/analytics/mrr`, `/analytics/churn`, `/analytics/revenue`

## Database Status

The database is powered by Neon PostgreSQL. All core tables (`users`, `customers`, `products`, `product_variants`, `subscription_plans`, `quotations`, `quotation_items`, `payments`, `payment_allocations`, `subscriptions`, `subscription_items`, `invoices`, `taxes`, `discounts`) are defined and synchronized.
