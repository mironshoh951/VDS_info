import { NextResponse } from 'next/server'
import { db } from '@/server/db/client'
import { getRedis } from '@/server/cache/redis'
import { logger } from '@/lib/logger'

/**
 * Readiness probe: can this instance actually serve traffic? Checks the
 * dependencies a request needs, with a short timeout so a hanging dependency
 * reports as unhealthy rather than holding the probe open.
 *
 * Failure detail is logged, never returned — a probe endpoint is unauthenticated.
 */
export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 2000

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<boolean> {
  try {
    await Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out`)), TIMEOUT_MS),
      ),
    ])
    return true
  } catch (error) {
    logger.error({ err: error, dependency: label }, 'readiness check failed')
    return false
  }
}

export async function GET() {
  const [database, redis] = await Promise.all([
    withTimeout(db.$queryRaw`SELECT 1`, 'database'),
    withTimeout(getRedis().ping(), 'redis'),
  ])

  const ready = database && redis

  return NextResponse.json(
    { status: ready ? 'ready' : 'degraded', checks: { database, redis } },
    { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
