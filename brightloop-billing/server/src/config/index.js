import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env relative to server root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const parseCorsOrigins = (rawOrigins) => {
  if (!rawOrigins) {
    return ['http://localhost:3000', 'http://localhost:5173'];
  }
  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '5000', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  databaseUrlUnpooled: process.env.DATABASE_URL_UNPOOLED || '',
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN)
};

export default config;
