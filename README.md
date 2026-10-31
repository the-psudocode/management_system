# Management System (Brightloop Billing)

A modern billing engine and subscription management platform built with React, Vite, Node.js, and Prisma backed by Neon PostgreSQL.

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
├── brightloop-billing/server/  # Express + Prisma + Neon PostgreSQL backend
│   ├── src/
│   │   ├── config/            # Environment & app config
│   │   ├── database/          # Prisma client with @prisma/adapter-neon
│   │   ├── middleware/        # Firebase auth, RBAC, error handling
│   │   ├── modules/           # Catalog, subscriptions, billing, quotations, payments, rules, analytics
│   │   └── jobs/              # Recurring billing scheduler
│   ├── prisma/                # schema.prisma & configuration
│   ├── test/                  # Automated unit and integration test suites
│   ├── docs/                  # Backend architecture specification
│   └── package.json
└── package.json               # Monorepo root runner
```

## Getting Started

### 1. Frontend Development

Run the frontend app from the root:
```bash
npm run dev
# or
npm run dev:frontend
```

Or directly inside the `frontend` folder:
```bash
cd frontend
npm install
npm run dev
```

Build for production:
```bash
npm run build
```

### 2. Backend Development

Run the backend server:
```bash
npm run dev:backend
```

Or directly inside the `brightloop-billing/server` directory:
```bash
cd brightloop-billing/server
npm install
npm run prisma:generate
npm run dev
```

To run backend automated test suites:
```bash
cd brightloop-billing/server
npm test
```

### 3. Demo Catalog

After configuring the backend environment variables and generating the Prisma client, add sample products, services, and subscription plans:

```bash
npm run seed:demo
```

The seed adds Brightloop Web Development, Cloud Hosting, Business Email, Cybersecurity Monitoring, Database Management, and Software Maintenance with sample INR plans. It is additive and idempotent: existing entries are skipped, never updated or deleted. It does not create fake subscriptions, invoices, or payments.

Customers can sign in, choose **Browse plans**, and request a plan. The request creates a draft subscription linked to the signed-in customer's own profile. Admin or staff must review and advance it through the existing lifecycle before invoices are generated. If the plans endpoint has no reachable catalog, the portal displays clearly labeled local preview data with purchasing disabled; this preview is not database data.

Authentication uses Firebase email/password. Public sign-up creates customer accounts only; database roles control redirection and authorization. Existing admin/staff/demo customer access requires Firebase accounts provisioned in the configured Firebase project and corresponding active database records. The quick-fill buttons only fill email addresses and never provide passwords or bypass authentication.

### 4. Environment & Configuration

Copy `.env.example` to `.env` inside `brightloop-billing/server/` only if a server `.env` does not already exist.

Configure:
- `DATABASE_URL`: Pooled connection string for runtime queries (`@neondatabase/serverless` with `@prisma/adapter-neon`).
- `DATABASE_URL_UNPOOLED`: Direct connection string for Prisma CLI.
- `FIREBASE_PROJECT_ID`: Firebase project identifier for token verification.
- `BUSINESS_STATE_CODE`: Business origin state code (e.g. `KA`) to calculate Indian GST (CGST/SGST vs IGST).

### 5. API Endpoints

- Health check: `GET /` and `GET /api/health`
- Versioned API (`/api/v1`):
  - Catalog: `/customers`, `/products`, `/plans`
  - Subscriptions & Quotations: `/subscriptions`, `/quotations`, `/quotation-templates`
  - Billing & Invoicing: `/billing/preview`, `/billing/run`, `/invoices`
  - Payments: `/payments`
  - Rules & Taxes: `/tax-rules`, `/discounts`
  - Analytics: `/analytics/mrr`, `/analytics/churn`, `/analytics/revenue`

## Database Status

The Prisma schema and generated client include both the initial tables and subscription/billing models. The live Neon database currently has the initial core tables. **Do not run destructive migrations or db push against production without testing on an isolated branch.**
