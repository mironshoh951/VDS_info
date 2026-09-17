import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/client'
import { getEnv } from '@/lib/env'
import { logger } from '@/lib/logger'
import { softDeleteExtension } from './soft-delete'

/**
 * The single Prisma client for the process.
 *
 * Prisma 7 requires an explicit driver adapter; the connection string comes
 * from validated environment, never from the schema file.
 *
 * The client is extended with a soft-delete filter so that ordinary reads can
 * never see deleted rows by accident. Code that genuinely needs deleted rows
 * (the trash view, restore, permanent delete) uses `dbRaw`, which is the
 * unextended client, and says so explicitly.
 */

function createClient() {
  const env = getEnv()
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })

  return new PrismaClient({
    adapter,
    log:
      env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ]
        : [
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ],
  })
}

type BaseClient = ReturnType<typeof createClient>

const globalForPrisma = globalThis as unknown as {
  __vdsPrisma?: BaseClient
}

const base: BaseClient = globalForPrisma.__vdsPrisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__vdsPrisma = base
}

base.$on('error', (event) => logger.error({ prisma: event }, 'prisma error'))
base.$on('warn', (event) => logger.warn({ prisma: event }, 'prisma warning'))

/**
 * Unextended client. Use only where deleted rows must be visible, and make the
 * reason obvious at the call site.
 */
export const dbRaw = base

/** The client every module should use. */
export const db = base.$extends(softDeleteExtension)

export type Db = typeof db
/** Transaction client type — the extended client inside `$transaction`. */
export type DbTransaction = Parameters<Parameters<Db['$transaction']>[0]>[0]
