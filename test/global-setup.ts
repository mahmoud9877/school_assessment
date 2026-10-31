import { execFileSync } from 'node:child_process';

// Creates the test database if needed and applies every migration, exactly
// as a deployment would. DATABASE_URL is already the test database here
// (see vitest.config.e2e.ts).
export default function setup() {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: process.env,
  });
}
