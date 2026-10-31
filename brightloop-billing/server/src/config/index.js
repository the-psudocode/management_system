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
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || '',
  billingWorkerEnabled: process.env.BILLING_WORKER_ENABLED === 'true',
  billingRunUtcHour: Math.min(23, Math.max(0, parseInt(process.env.BILLING_RUN_UTC_HOUR || '0', 10) || 0)),
  billingRunUtcMinute: Math.min(59, Math.max(0, parseInt(process.env.BILLING_RUN_UTC_MINUTE || '5', 10) || 0)),
  businessTimeZone: process.env.BUSINESS_TIMEZONE || 'Asia/Kolkata',
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN)
};

export default config;
