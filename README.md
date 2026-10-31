# Brightloop Billing

Brightloop Billing is a subscription and recurring-invoice management system. The repository contains a React/Vite admin UI and an Express/Prisma API backed by Neon PostgreSQL.

## Project layout

- `src/` — React and TypeScript frontend. Dashboard data is still backed by mock API functions.
- `brightloop-billing/server/` — Express API, Prisma schema/client, and backend modules.
- `brightloop-billing/server/docs/backend-architecture.md` — backend model, lifecycle, API, and migration design.

## Frontend

The root frontend dependencies are already installed in the current workspace.

```sh
npm run dev
```

## Backend

```sh
cd brightloop-billing/server
npm install
npm run prisma:generate
npm run dev
```

Copy `.env.example` to `.env` only if a server `.env` does not already exist. Configure `DATABASE_URL` with the pooled Neon URL and `DATABASE_URL_UNPOOLED` with the direct URL. The Prisma CLI reads the direct URL through `prisma.config.ts`.

Protected API routes require a Firebase ID token in `Authorization: Bearer <token>`. Set `FIREBASE_PROJECT_ID` and provide Firebase Admin Application Default Credentials in the runtime environment. User roles are loaded from `users.role` in Postgres. Set `BUSINESS_STATE_CODE` to enable India GST component selection.

The API health endpoints are `/` and `/api/health`. Versioned business routes use `/api/v1`, including `/customers`, `/products`, `/plans`, `/quotation-templates`, `/quotations`, `/subscriptions`, `/billing/preview`, `/billing/run`, `/invoices`, `/payments`, `/tax-rules`, `/discounts`, and `/analytics/*`.

## Database status

The Prisma schema and generated client include the existing five tables and the proposed billing models. The live Neon database still has its original five-table schema and has no Prisma migration history. **Do not run `prisma migrate dev`, `prisma migrate deploy`, or `db push` against that database until the baseline and additive migration SQL have been reviewed and tested on a Neon branch.** The API business routes require those migrations before they can use the new models.

## Current implementation limits

- The frontend dashboard still uses mock data and is not yet connected to the API.
- Billing can be previewed and run with an explicit date through the protected API. An opt-in daily worker is available; set `BILLING_WORKER_ENABLED=true` only after database migrations and billing rules are ready.
- Quotation/invoice email delivery and printable PDF generation are not configured.
- Firebase project credentials and `BUSINESS_STATE_CODE` are environment-specific and are not committed.
