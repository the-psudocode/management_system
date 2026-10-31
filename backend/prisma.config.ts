import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Prisma CLI (migrate, db push, studio) uses the DIRECT unpooled connection
    url: env('DATABASE_URL_UNPOOLED'),
  },
});
