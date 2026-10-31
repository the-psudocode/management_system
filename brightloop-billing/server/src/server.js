import app from './app.js';
import config from './config/index.js';
import { closeDatabase, checkDatabaseHealth } from './database/index.js';

const startServer = () => {
  const dbHealth = checkDatabaseHealth();
  console.log(`[Database] Status: ${dbHealth.status} | Journal Mode: ${dbHealth.journalMode} | Foreign Keys: ${dbHealth.foreignKeys}`);

  const server = app.listen(config.port, () => {
    console.log(`[Server] Brightloop Billing Server running in ${config.env} mode on http://localhost:${config.port}`);
    console.log(`[Server] Health endpoint: http://localhost:${config.port}/api/health`);
  });

  const handleShutdown = (signal) => {
    console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      console.log('[Server] HTTP server closed.');
      closeDatabase();
      console.log('[Database] SQLite connection closed.');
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

