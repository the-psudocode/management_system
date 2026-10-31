# Brightloop Billing — Management System

Subscription management and billing engine backend built with Node.js, Express, PostgreSQL, and Firebase Authentication.

## Project Structure
- `backend/`: Core backend API engine (Express.js, PostgreSQL `pg.Pool`, Firebase Admin SDK, Zod).
- `frontend/`: Client web application (kept separate from backend).

## Quick Start
```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Verify database connection
npm run db:verify

# Start development server
npm run dev
```

Or run directly from the project root:
```bash
npm start      # Starts the backend server
npm run dev    # Starts backend in watch mode
npm test       # Runs the test suite
npm run db:verify # Verifies PostgreSQL connection
```
