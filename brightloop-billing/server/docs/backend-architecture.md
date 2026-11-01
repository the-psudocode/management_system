# Brightloop Billing Backend Architecture (Proposal)

**Status:** Architecture proposal with an initial Prisma schema and generated client. Neon schema is unchanged; migration and API implementation remain pending.

## 1. Current baseline

- Express server, Neon PostgreSQL connection, Prisma 7 adapter, CORS, health checks, and centralized error handling are present.
- Neon currently has five `public` tables: `users`, `customers`, `products`, `product_variants`, and `subscription_plans`.
- There is no `_prisma_migrations` table. The Prisma schema now models the existing tables and proposed billing entities, but there are still no migration files.
- Frontend service calls currently return in-memory mock data. There are no business API routes.
- The existing database has `users.firebase_uid`, while the brief specifies email/password signup and email reset links. This needs an explicit authentication decision before implementing users.

## 2. Design goals

1. Preserve the five existing tables and their data; evolve them through reviewed, reproducible migrations.
2. Keep customer, product, plan, subscription, quotation, invoice, and payment records relational and auditable.
3. Snapshot financial terms and tax calculations onto issued documents so later catalog edits do not rewrite history.
4. Make scheduled billing safe to retry, including when multiple workers process due subscriptions.
5. Return paginated results and database aggregates so analytics can support thousands of subscriptions without loading the full dataset.

## 3. Proposed data model

Use the current snake_case table names with Prisma `@@map`/`@map` mappings. Use text IDs consistently with the existing tables. Store currency amounts as integer paise (`BIGINT` in Postgres); store API monetary values as decimal-free strings to avoid JavaScript `BigInt` JSON serialization and precision problems. Store event times as `timestamptz` and billing periods as `date`.

### Identity and customer access

- **User**: normalized unique email, name, role (`admin`, `staff`, `customer`), active/suspended state, Firebase UID, and timestamps.
- **Customer**: business/customer profile, billing address, GST details, account balance and credit limit. A customer can have multiple portal users; do not retain the current one-user-per-customer uniqueness if this is confirmed as a requirement.
- **AuditLog**: actor, action, entity type and ID, timestamp, request/correlation ID, and structured before/after metadata. Do not store passwords, tokens, or payment secrets in audit metadata.

### Catalog and plans

- **Product**: name, type, description/notes, sales price, cost price, currency, and active/archived state.
- **ProductVariant**: product, name/brand/SKU and explicit price adjustment or replacement price. The brief's example (choosing a brand adds 560) suggests an adjustment, but that interpretation needs confirmation. Keep old variants when referenced by billing history.
- **SubscriptionPlan**: product, optional default variant, name, interval unit and positive interval count, minimum quantity, base amount, availability dates, auto-close setting, currency, and active/archived state. Billing supports daily, weekly, monthly, quarterly, half-yearly, and yearly periods; each product can offer its own subset of active plans.

### Quotations and subscriptions

- **QuotationTemplate** and **QuotationTemplateItem**: reusable defaults for sales. Templates are editable catalog records.
- **Quotation** and **QuotationItem**: customer-specific offer, number, issue/expiry dates, payment terms, status, currency, and immutable line/tax/discount snapshots. Statuses: `DRAFT`, `SENT`, `ACCEPTED`, `DECLINED`, `EXPIRED`, `CONVERTED`.
- **Subscription**: customer, public number, source quotation (optional), lifecycle status, currency, payment terms, start/end/next billing dates, auto-renew/auto-close flags, pause/close metadata, and timestamps.
- **SubscriptionItem**: subscription, plan/product/variant references, quantity, description, unit-price snapshot, and effective dates. Treat an add-on as an item with the subscription's billing cadence unless the product requirement explicitly allows mixed-cadence items.
- Subscription lifecycle: `DRAFT -> QUOTATION -> CONFIRMED -> ACTIVE -> CLOSED`; `ACTIVE <-> PAUSED` is an allowed temporary branch. Reject invalid transitions. A renewal extends/creates a term and is recorded in audit history rather than silently overwriting prior terms.

### Taxes, discounts, invoices, and payments

- **TaxRule**: active date range, rate in basis points, tax type (including CGST/SGST/IGST), applicability/scope, and ordering/combination policy. The issuing business's state and the customer's supply state determine intra-state vs inter-state treatment.
- **Discount**: fixed or percentage, active date range, minimum purchase and/or quantity, maximum redemption count, scope (whole subscription and/or selected products), and active state.
- **DiscountProduct**: eligible product join table.
- **DiscountRedemption**: one row per applied discount and invoice, with the exact amount and timestamp. Enforce one redemption per discount/invoice; enforce a cap transactionally so concurrent invoice runs cannot overspend the limit.
- **BillingPeriod**: unique `(subscription_id, period_start, period_end)` idempotency key. It allows a cancelled invoice to be replaced with a new revision without issuing two live invoices for the same period.
- **Invoice**: customer, subscription, billing period, revision, unique invoice number, issue/due dates, currency, status, and subtotal/tax/discount/total snapshots. Enforce one invoice revision per billing period and check for an existing non-cancelled invoice transactionally.
- **InvoiceItem**: product/variant references where retained, but always snapshot description, quantity, unit price, discount, tax, and total.
- **InvoiceItemTax**: tax name/type/rate/taxable amount/tax amount snapshots for each line tax component.
- **Payment**: customer, method, amount, received date, reference, notes, and recorded-by user.
- **PaymentAllocation**: payment-to-invoice amount. This supports partial payments and one payment allocated across invoices. Enforce positive allocations and prevent allocations exceeding the payment or invoice balance inside a transaction.

For invoices, keep document state (`DRAFT`, `CONFIRMED`, `CANCELLED`) separate from collection state (`UNPAID`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`), with collection state derived from allocations and due date. This makes partial payments and overdue behavior unambiguous. A confirmed/cancelled invoice and its financial snapshots must not be silently edited; use a credit/reversal workflow if correction is required.

## 4. Billing and calculation rules

- Generate invoices from due active subscriptions and their item snapshots; never construct an invoice from current catalog prices alone.
- A billing run accepts an explicit business date. A preview (`dryRun`) returns due subscriptions and calculated totals without writing. A committed run processes each subscription in a transaction and relies on the unique period constraint for retry safety.
- Claim due work in bounded batches and use row locking/conditional updates to prevent two workers from creating the same invoice. Record run summaries and errors without leaking customer secrets.
- Derive each billing period from the subscription cadence and stored next-billing date; define month-end behavior (for example, Jan 31 to Feb 28/29) before coding.
- Calculate line subtotal, eligible discount, taxable base, tax components, and final total in integer minor units using one documented rounding policy. Persist each result as a snapshot.
- Apply discounts only when active, within dates, within remaining usage, and eligible by minimum purchase/quantity and product scope. Stop applying automatically once expired or exhausted.
- Outstanding balance is confirmed invoice total less valid payment allocations. Overdue means a positive balance past due date. Paid/overdue counts and revenue must be based on this rule, not manually maintained counters.
- Use soft archive for catalog records used by quotations, subscriptions, or invoices. Do not cascade-delete financial history.

## 5. Proposed API contract (v1)

All routes are under `/api/v1`. JSON uses camelCase. IDs and money values are strings; quantities and counts are numbers. Dates are ISO `YYYY-MM-DD`; instants are ISO 8601 UTC. List routes use `page`/`pageSize` and return `{ data, page, pageSize, total, totalPages }`. Errors use the existing `{ success: false, message, details? }` envelope.

| Area | Routes (initial contract) |
| --- | --- |
| Customers | `GET/POST /customers`, `GET/PATCH /customers/:id`, `POST /customers/:id/archive` |
| Products/variants | `GET/POST /products`, `GET/PATCH /products/:id`, `POST /products/:id/archive`, variant CRUD under `/products/:id/variants` |
| Plans | `GET/POST /plans`, `GET/PATCH /plans/:id`, `POST /plans/:id/archive` |
| Quotations | CRUD `/quotation-templates`; `GET/POST /quotations`, `GET/PATCH /quotations/:id`, action routes `/send`, `/accept`, `/decline`, `/convert` |
| Subscriptions | `GET/POST /subscriptions`, `GET/PATCH /subscriptions/:id`, actions `/request-quotation`, `/confirm`, `/activate`, `/pause`, `/resume`, `/renew`, `/close`; invoice history at `/:id/invoices` |
| Taxes/discounts | Admin-only CRUD `/tax-rules` and `/discounts`; discounts expose eligible product IDs and redemption summary |
| Invoices | `GET /invoices` with filters, `GET /invoices/:id`, actions `/confirm`, `/cancel`, `/send`, and a printable/PDF representation |
| Payments | `POST /invoices/:id/payments`, `GET /payments`, payment details and allocation records |
| Billing | Admin-only `POST /billing/preview` and `POST /billing/run`, each requiring `billingDate`; run also accepts an idempotency key |
| Analytics | `GET /analytics/dashboard`, `/analytics/revenue`, `/analytics/overdue`, all with date/status/customer filters and DB-side aggregation |

All create/update/action routes validate input with Zod, enforce role/resource access, write audit events for financial or lifecycle actions, and execute multi-record financial changes transactionally. Exact route names can be adjusted with the frontend team before implementation.

## 6. Authorization baseline

- **Admin**: manage users, catalog, plans, tax/discount rules, billing runs, and all reporting/business records.
- **Staff**: daily customer, quotation, subscription, invoice, and payment operations; cannot create staff/admin users or change system-wide tax/discount policy unless explicitly granted.
- **Customer**: read only their own customer profile, subscriptions, quotations/invoices, and payment history; no access to another customer's IDs or admin endpoints.
- The backend must verify identity tokens or sessions on every protected route. CORS is not authentication.
- Resolve the auth conflict before implementation: either Firebase remains the identity provider and password/reset requirements are handled there, or the backend owns password hashes, reset tokens, and sessions. Never store plaintext passwords or reset tokens.

## 7. Migration and rollout plan

1. Confirm the auth provider, customer-to-user cardinality, product variant price semantics, tax jurisdiction/rounding, invoice cadence/end-of-month rule, and role permissions with the product owner/frontend developers.
2. Import and compare the five live table definitions against Prisma models. Create a baseline migration matching only the existing schema; verify its SQL against Neon before marking it applied. Do not run `db push` against the existing database.
3. Create a Neon development branch and test the baseline and additive business migrations there. Review `neon diff` and migration SQL before deployment.
4. Add billing tables in additive, reversible stages. Back up/verify the target branch and deploy migrations with the direct/unpooled connection only after review.
5. Implement and demonstrate in order: auth/roles and catalog; quotations/subscription lifecycle; taxes/discounts; invoices and recurring billing; payments/overdue; analytics and date simulation.
6. Add unit/integration coverage for calculations, invalid transitions, authorization, discount caps, partial payments, duplicate billing, retry behavior, and simulated dates before enabling scheduled billing.

## 8. Decisions needed before Prisma implementation

1. **Resolved:** Firebase handles email/password sign-in and reset links; the backend verifies Firebase ID tokens and loads roles from the `users` table.
2. Can a business customer have multiple portal users? The PDF's account model implies yes; the existing schema enforces one.
3. Does a product variant price replace the product price or add to it? The brand example suggests an additive price adjustment.
4. Are taxes India GST-only, and what is the business's origin state, tax-inclusive/exclusive pricing policy, and rounding rule?
5. Can one subscription contain add-ons with a different billing cadence, or must all its lines share the plan cadence?
6. What are the invoice due-date/payment-term rules, and may confirmed invoices with payments be cancelled?
7. Should customer users view quotations, and can they accept/decline them in the portal?

## 9. Implementation checkpoint

- `prisma/schema.prisma` now contains the five existing models plus quotation templates, quotations, subscription lifecycle, taxes, discounts/redemptions, invoices, payments/allocations, and audit logs.
- `npm run prisma:generate` completed successfully with Prisma Client 7.10.1.
- Firebase Admin token verification and role guards are wired. Business routes exist for catalog CRUD, subscription lifecycle, quotation conversion, tax/discount administration, billing preview/run, invoice confirmation/cancellation, payments, and analytics.
- An opt-in daily billing scheduler calls the same idempotent runner. It uses the configured business timezone for the billing date and remains disabled unless `BILLING_WORKER_ENABLED=true`.
- No migration SQL has been created or applied, and no Neon schema changes have been made. Runtime business routes will need an additive migration after a baseline because the live database has no Prisma migration history.
- The root frontend dependencies are already installed in this workspace (`npm ls --depth=0` resolves them), so a second root `npm install` was unnecessary and avoided changing the existing lockfile diff.
- The Firebase project ID and Admin Application Default Credentials must be configured at runtime. `BUSINESS_STATE_CODE` is needed for GST component selection.
- Decisions in Section 8 still need agreement before tax, variant pricing, customer account cardinality, and billing-period end behavior are finalized.
