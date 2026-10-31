import { initDatabase } from '../../database/schema.js';

/**
 * Initializes authentication and customer tables in PostgreSQL.
 * Delegates to centralized database schema initialization.
 */
export const initAuthSchema = async (clientOrPool) => {
  return initDatabase(clientOrPool);
};

export default initAuthSchema;
