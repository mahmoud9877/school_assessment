// The e2e suite truncates every table, so it must never touch the dev
// database. It uses TEST_DATABASE_URL, or DATABASE_URL with "_test" appended
// to the database name, and refuses any database whose name lacks "_test".
export function testDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const source = env.TEST_DATABASE_URL ?? env.DATABASE_URL;
  if (!source) {
    throw new Error('Set DATABASE_URL or TEST_DATABASE_URL to run e2e tests');
  }
  const url = new URL(source);
  if (!env.TEST_DATABASE_URL) {
    url.pathname = `${url.pathname}_test`;
  }
  if (!url.pathname.endsWith('_test')) {
    throw new Error(
      `Refusing to run e2e tests against ${url.pathname.slice(1)}`,
    );
  }
  return url.toString();
}
