/**
 * Global test setup.
 *
 * Fills in the secrets the environment validator requires, and refuses to run
 * if the configured database looks like production — a test suite that
 * truncates tables must never be one typo away from real data.
 */
const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  PUBLIC_HOST: 'localhost:3000',
  ADMIN_HOST: 'admin.localhost:3000',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  NEXT_PUBLIC_ADMIN_URL: 'http://admin.localhost:3000',
  DATABASE_URL: 'postgresql://vds:vds@localhost:5432/vds_test?schema=public',
  REDIS_URL: 'redis://localhost:6379',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'vds-media-test',
  S3_ACCESS_KEY_ID: 'test',
  S3_SECRET_ACCESS_KEY: 'test',
  S3_PUBLIC_BASE_URL: 'http://localhost:9000/vds-media-test',
  SESSION_SECRET: 'test-session-secret-not-used-in-production-0123456789',
  ENCRYPTION_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25nISE=',
  LOG_LEVEL: 'error',
}

for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) {
    Reflect.set(process.env, key, value)
  }
}

const url = process.env['DATABASE_URL'] ?? ''
if (/prod/i.test(url)) {
  throw new Error('Refusing to run tests against a production-looking DATABASE_URL')
}
