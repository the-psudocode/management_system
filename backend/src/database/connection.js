import pg from 'pg';
import config from '../config/index.js';

const { Pool } = pg;

let poolInstance = null;

/**
 * Creates or retrieves the singleton PostgreSQL connection pool.
 * Centralized pool configured via DATABASE_URL and pool parameters.
 */
export const getPool = () => {
  if (!poolInstance) {
    if (!config.databaseUrl) {
      console.warn('[PostgreSQL Pool] Warning: DATABASE_URL is not set in environment variables.');
    }

    const poolConfig = {
      connectionString: config.databaseUrl,
      max: config.db.max || 20,
      idleTimeoutMillis: config.db.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.db.connectionTimeoutMillis || 5000,
      ssl: config.db.ssl
    };

    poolInstance = new Pool(poolConfig);

    // Connection error handler for idle clients in pool
    poolInstance.on('error', (err) => {
      console.error('[PostgreSQL Pool] Unexpected error on idle client:', err.message);
    });

    poolInstance.on('connect', () => {
      if (config.env === 'development') {
        // Connected a new client to the pool
      }
    });
  }

  return poolInstance;
};

/**
 * Executes a parameterized SQL query on the pool.
 * Requirement 8: Parameterized SQL queries ($1, $2, ...).
 *
 * @param {string} text - SQL query text
 * @param {Array} [params] - Parameterized values
 * @returns {Promise<pg.QueryResult>}
 */
export const query = async (text, params = []) => {
  const start = Date.now();
  const pool = getPool();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (config.env === 'development' && process.env.DEBUG_SQL === 'true') {
      console.log('[PostgreSQL Query]', { text, duration: `${duration}ms`, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('[PostgreSQL Query Error]', { text, error: error.message });
    throw error;
  }
};

/**
 * Acquires a dedicated client from the pool.
 * Must be released with client.release().
 */
export const getClient = async () => {
  const pool = getPool();
  const client = await pool.connect();
  return client;
};

/**
 * Requirement 7: Execute database transactions with BEGIN, COMMIT and ROLLBACK.
 *
 * @param {Function} callback - Async callback receiving the transactional client: async (client) => { ... }
 * @returns {Promise<any>} Result returned from callback
 */
export const withTransaction = async (callback) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[PostgreSQL] Failed to rollback transaction:', rollbackError.message);
    }
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Health check for PostgreSQL database connection pool.
 */
export const checkDatabaseHealth = async () => {
  try {
    if (!config.databaseUrl) {
      return {
        status: 'disconnected',
        alive: false,
        error: 'DATABASE_URL is not configured'
      };
    }

    const pool = getPool();
    const result = await pool.query(`
      SELECT 
        1 AS is_alive, 
        NOW() AS server_time, 
        current_database() AS database_name,
        version() AS version
    `);

    return {
      status: 'connected',
      alive: result.rows[0]?.is_alive === 1,
      database: result.rows[0]?.database_name,
      serverTime: result.rows[0]?.server_time,
      pool: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      }
    };
  } catch (error) {
    return {
      status: 'disconnected',
      alive: false,
      error: error.message || error.code || 'Connection failed or server unreachable'
    };
  }
};

/**
 * Gracefully terminates the PostgreSQL connection pool.
 */
export const closeDatabase = async () => {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
};

export const pool = getPool();
export default pool;
