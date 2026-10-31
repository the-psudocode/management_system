# Management System (Brightloop Billing)

A modern billing engine and subscription management platform built with React, Vite, Node.js, and Prisma.

## Project Structure

```text
management_system/
├── frontend/                 # React 19 + TypeScript + Vite + Tailwind CSS frontend
│   ├── src/
│   │   ├── components/       # Layout (Sidebar, Navbar), common widgets
│   │   ├── pages/            # Dashboard, Customers, Products, Subscriptions, Invoices, Auth
│   │   ├── services/         # API service layer
│   │   ├── data/             # Mock data store
│   │   ├── types/            # TypeScript data contracts & models
│   │   └── utils/            # Currency & date formatters
│   ├── package.json
│   └── vite.config.ts
├── brightloop-billing/server/ # Express + Prisma + Neon PostgreSQL backend
│   ├── src/
│   ├── prisma/
│   └── package.json
└── package.json              # Monorepo root runner
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
# or
cd brightloop-billing/server
npm run dev
```
