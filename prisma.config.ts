import 'dotenv/config'
import path from 'node:path'
import { defineConfig, env } from 'prisma/config'

/**
 * Prisma 7 configuration.
 *
 * Connection URLs live here (and in the environment) rather than in
 * schema.prisma, so the schema file contains no environment coupling and no
 * secret ever reaches version control.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),

  datasource: {
    url: env('DATABASE_URL'),
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
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
