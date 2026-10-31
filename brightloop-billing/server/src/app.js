import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import { checkDatabaseHealth } from './database/index.js';
import { notFound, errorHandler } from './middleware/index.js';
import { sendSuccess } from './utils/response.js';

export const createApp = () => {
  const app = express();

  // Basic security and parsing middleware
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive during early local development
    },
    credentials: true
  }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Root endpoint
  app.get('/', (req, res) => {
    sendSuccess(res, { service: 'Brightloop Billing API', version: '1.0.0' }, 'Welcome to Brightloop Billing API');
  });

  // Health endpoint
  app.get('/api/health', (req, res) => {
    const dbHealth = checkDatabaseHealth();
    const isHealthy = dbHealth.status === 'connected' && dbHealth.alive;

    const payload = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: config.env,
      database: dbHealth
    };

    return sendSuccess(
      res,
      payload,
      isHealthy ? 'Brightloop Billing API is operational' : 'Database health check failed',
      isHealthy ? 200 : 503
    );
  });

  // 404 Not Found Middleware
  app.use(notFound);

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
};

export const app = createApp();
export default app;

