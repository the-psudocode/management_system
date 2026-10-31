import app from './app.js';
import config from './config/index.js';
import { closeDatabase, checkDatabaseHealth, initDatabase } from './database/index.js';

const startServer = async () => {
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.alive) {
    console.log(`[Database] PostgreSQL connected | DB: ${dbHealth.database} | Time: ${dbHealth.serverTime}`);
    try {
      await initDatabase();
      console.log('[Database] PostgreSQL schema initialized successfully.');
    } catch (schemaErr) {
      console.error('[Database] Warning: PostgreSQL schema initialization error:', schemaErr.message);
    }
  } else {
    console.warn(`[Database] PostgreSQL status: ${dbHealth.status}. Reason: ${dbHealth.error || 'Connection failed'}`);
    console.warn('[Database] The API will start in degraded mode. Supply a valid DATABASE_URL in .env to connect.');
  }

  const server = app.listen(config.port, () => {
    console.log(`[Server] Brightloop Billing Server running in ${config.env} mode on http://localhost:${config.port}`);
    console.log(`[Server] Health endpoint: http://localhost:${config.port}/api/health`);
  });

  const handleShutdown = async (signal) => {
    console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      await closeDatabase();
      console.log('[Database] PostgreSQL connection pool closed.');
      process.exit(0);
    });

    // Force shutdown after timeout if pending requests hang
    setTimeout(() => {
      console.error('[Server] Forcing shutdown after timeout.');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  return server;
};

// Start the server if executed directly
startServer();

