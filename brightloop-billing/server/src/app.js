import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import { checkDatabaseHealth } from './database/index.js';
import { notFound, errorHandler } from './middleware/index.js';
import { ApiError } from './utils/ApiError.js';
import { sendSuccess } from './utils/response.js';

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
