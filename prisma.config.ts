import 'dotenv/config'
import path from 'node:path'
import { defineConfig } from 'prisma/config'

/**
 * Prisma 7 configuration.
 *
 * Connection URLs live here (and in the environment) rather than in
 * schema.prisma, so the schema file contains no environment coupling and no
 * secret ever reaches version control.
 */
/**
 * Read directly rather than through Prisma's `env()` helper, which throws while
 * the config file is still loading when the variable is absent.
 *
 * That distinction matters because `prisma generate` needs the schema and no
 * database at all: it runs in the Docker build and in the CI job that only
 * typechecks, neither of which has — or should have — a connection string.
 * Failing those is wrong. A command that genuinely needs the database still
 * fails, with Prisma's own message about the URL, at the point it tries to
 * connect.
 */
const databaseUrl = process.env['DATABASE_URL'] ?? ''

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),

  datasource: {
    url: databaseUrl,
    shadowDatabaseUrl: process.env['SHADOW_DATABASE_URL'],
  },

  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed/index.ts',
  },

  experimental: {
    // Required for the `extensions` block in schema.prisma
    // (vector, pg_trgm, unaccent, citext, btree_gin).
    extensions: true,
  },
})
