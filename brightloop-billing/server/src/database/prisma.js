import { PrismaClient, Prisma } from '../generated/prisma/index.js';
import { PrismaNeon } from '@prisma/adapter-neon';
import config from '../config/index.js';

const createPrismaClient = () => {
  const connectionString = config.databaseUrl || process.env.DATABASE_URL;
  if (!connectionString) {
    return new PrismaClient();
  }

  const adapter = new PrismaNeon({
    connectionString
  });

  return new PrismaClient({
    adapter,
    log: config.isProduction ? ['error'] : ['warn', 'error']
  });
};

const globalForPrisma = globalThis;
export const prisma = globalForPrisma.__prisma ?? createPrismaClient();

if (config.env !== 'production') {
  globalForPrisma.__prisma = prisma;
}

export const checkDatabaseHealth = async () => {
  const connectionString = config.databaseUrl || process.env.DATABASE_URL;
  if (!connectionString) {
    return {
      status: 'disconnected',
      provider: 'neon-postgresql',
      error: 'DATABASE_URL is not configured.'
    };
  }

  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1 as is_alive`;
    return {
      status: 'connected',
      provider: 'neon-postgresql',
      latencyMs: Date.now() - start
    };
  } catch (error) {
    return {
      status: 'disconnected',
      provider: 'neon-postgresql',
      error: 'Database is unreachable or not responding.'
    };
  }
};

export const disconnectDatabase = async () => {
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error('[Database] Disconnect warning:', error?.message || 'Error disconnecting');
  }
};

export { Prisma };
export default prisma;
