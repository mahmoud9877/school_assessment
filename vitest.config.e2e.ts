import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from './test/test-database.js';

const random = () => randomBytes(24).toString('base64url');

// Point everything at the test database, and generate fresh secrets for every
// run so the suite never depends on (or leaks) the real ones in .env.
process.env.DATABASE_URL = testDatabaseUrl();
const env = {
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: random(),
  JWT_EXPIRES_IN: '5m',
  SEED_ADMIN_PASSWORD: random(),
  SEED_OPERATOR_PASSWORD: random(),
  SEED_TEACHER_PASSWORD: random(),
  SEED_STUDENT_PASSWORD: random(),
};

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    env,
    globalSetup: './test/global-setup.ts',
    // Test files share one database, so they must not run concurrently.
    fileParallelism: false,
    hookTimeout: 60_000,
  },
});
