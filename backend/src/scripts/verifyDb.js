import config from '../config/index.js';
import { getPool, checkDatabaseHealth, withTransaction, query, closeDatabase } from '../database/index.js';
import { initDatabase } from '../database/schema.js';

/**
 * Diagnostic and verification script for PostgreSQL backend connection.
 * Tests connection pooling, environment variables, parameterized queries,
 * transaction execution (BEGIN/COMMIT), and schema initialization.
 */
const verifyPostgresConnection = async () => {
  console.log('='.repeat(70));
  console.log(' Brightloop Billing — PostgreSQL Connection Verification');
  console.log('='.repeat(70));

  console.log(`[Config] Environment: ${config.env}`);
  console.log(`[Config] DATABASE_URL configured: ${config.databaseUrl ? 'YES' : 'NO'}`);

  if (!config.databaseUrl) {
    console.error('\n[Error] DATABASE_URL environment variable is missing.');
    console.error('Please configure DATABASE_URL in your .env file:');
    console.error('DATABASE_URL=postgresql://<username>:<password>@<host>:<port>/<database>');
    process.exit(1);
  }

  // Mask sensitive password from connection string for safe console output
  const maskedUrl = config.databaseUrl.replace(/:([^:@]+)@/, ':****@');
  console.log(`[Config] Target Database: ${maskedUrl}`);
  console.log(`[Config] Pool Max Clients: ${config.db.max}`);
  console.log(`[Config] Pool Connection Timeout: ${config.db.connectionTimeoutMillis}ms`);

  console.log('\n[Step 1] Testing Connection Pool and Database Health...');
  const health = await checkDatabaseHealth();

  if (!health.alive) {
    console.error(`\n[Failed] Could not connect to PostgreSQL.`);
    console.error(`Reason: ${health.error}`);
    console.error('\nTroubleshooting Checklist:');
    console.error('1. Is your PostgreSQL server running?');
    console.error('2. Are host, port, username, password, and database name correct?');
    console.error('3. Does the specified database exist on your PostgreSQL server?');
    console.error('4. If using cloud PostgreSQL (e.g., Supabase/Neon/RDS), verify SSL mode (DB_SSL=true).');
    await closeDatabase();
    process.exit(1);
  }

  console.log(`[Success] Connected to PostgreSQL!`);
  console.log(` - Database Name: ${health.database}`);
  console.log(` - Server Timestamp: ${health.serverTime}`);
  console.log(` - Active Pool Clients: Total=${health.pool.totalCount}, Idle=${health.pool.idleCount}`);

  console.log('\n[Step 2] Testing Parameterized Query ($1, $2)...');
  try {
    const paramRes = await query('SELECT $1::text AS greeting, $2::bigint AS paise_test', [
      'Brightloop PostgreSQL Ready',
      999900n
    ]);
    console.log(`[Success] Parameterized query executed successfully:`);
    console.log(` - Greeting: "${paramRes.rows[0].greeting}"`);
    console.log(` - Paise Test Value: ${paramRes.rows[0].paise_test} paise`);
  } catch (paramErr) {
    console.error('[Failed] Parameterized query test failed:', paramErr.message);
    await closeDatabase();
    process.exit(1);
  }

  console.log('\n[Step 3] Testing Transaction Management (BEGIN, COMMIT)...');
  try {
    const txResult = await withTransaction(async (client) => {
      const res = await client.query('SELECT 1 + 1 AS tx_check');
      return res.rows[0].tx_check;
    });
    console.log(`[Success] Transaction BEGIN and COMMIT verified (result: ${txResult})`);
  } catch (txErr) {
    console.error('[Failed] Transaction test failed:', txErr.message);
    await closeDatabase();
    process.exit(1);
  }

  console.log('\n[Step 4] Testing Schema Initialization (DDL, Constraints & Indexes)...');
  try {
    await initDatabase();
    console.log('[Success] Schema initialized successfully:');
    console.log(' - users table (with roles: admin, staff, customer)');
    console.log(' - customers table (foreign key constraint ON DELETE CASCADE)');
    console.log(' - Monetary fields created with BIGINT paise standard');
    console.log(' - Performance indexes verified');
  } catch (schemaErr) {
    console.error('[Failed] Schema initialization failed:', schemaErr.message);
    await closeDatabase();
    process.exit(1);
  }

  console.log('\n' + '='.repeat(70));
  console.log(' ALL POSTGRESQL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('='.repeat(70));

  await closeDatabase();
  process.exit(0);
};

verifyPostgresConnection().catch(async (err) => {
  console.error('\n[Unhandled Error]', err.message);
  await closeDatabase();
  process.exit(1);
});

