import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import { checkDatabaseHealth } from './database/index.js';
import { notFound, errorHandler } from './middleware/index.js';
import { ApiError } from './utils/ApiError.js';
import { sendSuccess } from './utils/response.js';
import catalogRoutes from './modules/catalog/routes.js';
import { requireFirebaseUser } from './middleware/firebaseAuth.js';
import subscriptionRoutes from './modules/subscriptions/routes.js';
import billingRoutes from './modules/billing/routes.js';
import paymentRoutes from './modules/payments/routes.js';
import ruleRoutes from './modules/rules/routes.js';
import analyticsRoutes from './modules/analytics/routes.js';
import quotationRoutes from './modules/quotations/routes.js';
import portalRoutes from './modules/portal/routes.js';
import authRoutes from './modules/auth/routes.js';

export const createApp = () => {
  const app = express();

  // Strict CORS allowlist implementation
  const corsOptions = {
    origin: (origin, callback) => {
      // Allow non-browser or same-origin requests without an Origin header (curl, Postman, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      // Check against configured allowlist
      if (config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Reject unauthorized origin through Express centralized error handling
      const corsError = ApiError.forbidden(`Origin '${origin}' is not permitted by CORS policy.`);
      return callback(corsError);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 204
  };

  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Public authentication routes (login, signup) mounted before requireFirebaseUser
  app.use('/api/v1', authRoutes);

  const api = express.Router();
  api.use(requireFirebaseUser);
  api.get('/me', (req, res) => sendSuccess(res, {
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
  }));
  api.use(catalogRoutes, billingRoutes, paymentRoutes, ruleRoutes, analyticsRoutes, quotationRoutes, subscriptionRoutes, portalRoutes);
  app.use('/api/v1', api);

  // Root endpoint
  app.get('/', (req, res) => {
    sendSuccess(res, { service: 'Brightloop Billing API', version: '1.0.0' }, 'Welcome to Brightloop Billing API');
  });

  // Health endpoint - Decoupled application vs database status
  app.get('/api/health', async (req, res, next) => {
    try {
      const dbHealth = await checkDatabaseHealth();
      const isDbConnected = dbHealth.status === 'connected';

      const payload = {
        status: isDbConnected ? 'healthy' : 'degraded',
        server: {
          status: 'online',
          uptimeSeconds: Math.floor(process.uptime()),
          environment: config.env,
          timestamp: new Date().toISOString()
        },
        database: dbHealth
      };

      return sendSuccess(
        res,
        payload,
        isDbConnected ? 'Brightloop Billing API is operational' : 'Database service is currently unavailable',
        isDbConnected ? 200 : 503
      );
    } catch (err) {
      next(err);
    }
  });

  // 404 Not Found Middleware
  app.use(notFound);

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
};

export const app = createApp();
export default app;
