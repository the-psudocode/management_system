# Brightloop Billing — Management System

A subscription management system featuring a modern React frontend and a robust Node.js/PostgreSQL backend engine.

---

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
├── backend/                  # Express.js + PostgreSQL (Neon) + Firebase Admin SDK backend
│   ├── src/
│   │   ├── config/           # Firebase & App configuration
│   │   ├── database/         # PostgreSQL connection pool & schema
│   │   ├── middleware/       # Authentication (Firebase) & RBAC authorization
│   │   ├── modules/          # Auth, Customer CRUD, Products, etc.
│   │   └── utils/            # Standard response & error handlers
│   ├── tests/                # Automated test suites
│   └── package.json
└── package.json              # Monorepo root runner
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

Or navigate to `frontend/`:
```bash
cd frontend
npm install
npm run dev
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
npm run dev
```
