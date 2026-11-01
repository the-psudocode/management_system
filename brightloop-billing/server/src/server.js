import app from './app.js';
import config from './config/index.js';
import { disconnectDatabase, checkDatabaseHealth } from './database/index.js';
import { startBillingScheduler } from './jobs/billingScheduler.js';

const startServer = async () => {
  let stopBillingScheduler = () => {};
  // Check database connectivity on startup (non-fatal, server still starts to serve health status)
  const dbHealth = await checkDatabaseHealth();
  console.log(`[Database] Status: ${dbHealth.status} | Provider: ${dbHealth.provider}`);

  if (dbHealth.status !== 'connected') {
    console.warn('[Database] Warning: Initial PostgreSQL connection check failed. The server will start in degraded state.');
  }

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[Server] Brightloop Billing Server running in ${config.env} mode on http://localhost:${config.port}`);
    console.log(`[Server] Health endpoint: http://localhost:${config.port}/api/health`);
    stopBillingScheduler = startBillingScheduler();
    try { process.stdin.resume(); } catch {}
  });

  // Keep event loop active indefinitely for Windows daemon
  setInterval(() => {}, 60000);

  const handleShutdown = async (signal) => {
    console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      stopBillingScheduler();
      await disconnectDatabase();
      console.log('[Database] Neon PostgreSQL connection closed.');
      process.exit(0);
    });

    // Force shutdown after timeout if pending connections hang
    setTimeout(() => {
      console.error('[Server] Forcing shutdown after timeout.');
      process.exit(1);
    }, 8000);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  return server;
};

// Start the server
startServer().catch((error) => {
  console.error('[Server] Fatal startup error:', error);
  process.exit(1);
});
