# Brightloop Billing — Management System

A subscription management system featuring a modern React frontend and a robust Node.js/PostgreSQL backend engine.

---

## Project Structure

- **Frontend** (Root): React 19, TypeScript, Vite, TailwindCSS, React Router, Recharts, Lucide.
- **Backend** (`backend/`): Node.js, Express.js, PostgreSQL (Neon), Firebase Authentication, Zod.

---

## Quick Start

### 1. Backend Setup
```bash
# Navigate to backend
cd backend

# Install backend dependencies
npm install

# Verify database connection
npm run db:verify

# Start backend server (http://localhost:5000)
npm run dev
```

### 2. Frontend Setup
From the project root:
```bash
# Install frontend dependencies
npm install

# Start Vite frontend dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build
```

### 3. Running from Root
```bash
# Start frontend
npm run dev

# Start backend server
npm run backend:dev

# Run backend test suite
npm run backend:test

# Verify database connection
npm run backend:verify
```
