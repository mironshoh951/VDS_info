import Redis, { type Redis as RedisClient, type RedisOptions } from 'ioredis'
import { getEnv } from '@/lib/env'
import { logger } from '@/lib/logger'

/**
 * Shared Redis connections.
 *
 * Two clients are kept deliberately: BullMQ requires a connection with
 * `maxRetriesPerRequest: null`, while application caching wants fail-fast
 * behaviour so a Redis outage degrades the site rather than hanging it.
 *
 * Connection errors are logged at most once per minute per client. Without
 * that throttle a stopped Redis produces one stack trace per request, which
 * buries every other message in the terminal — the developer sees noise
 * instead of the one line that tells them what to start.
 */

const globalForRedis = globalThis as unknown as {
  __vdsRedis?: RedisClient
  __vdsRedisQueue?: RedisClient
  __vdsRedisLastLog?: Record<string, number>
  __vdsRedisDownUntil?: number
}

/**
 * Circuit breaker.
 *
 * Without one, every cache read on every request still tries to reach a Redis
 * that is not there. Each attempt waits on a connection that is being retried
 * with growing backoff, so pages crawl. After the first failure Redis is
 * treated as down for a cooldown and skipped outright; the client reconnects
 * on its own, and the first successful connection clears the flag.
 */
const DOWN_COOLDOWN_MS = 30_000

export function redisAvailable(): boolean {
  return (globalForRedis.__vdsRedisDownUntil ?? 0) < Date.now()
}

function markDown(): void {
  globalForRedis.__vdsRedisDownUntil = Date.now() + DOWN_COOLDOWN_MS
}

function markUp(): void {
  globalForRedis.__vdsRedisDownUntil = 0
}

const ERROR_LOG_INTERVAL_MS = 60_000

function logConnectionError(clientName: string, error: Error): void {
  const now = Date.now()
  const lastLog = (globalForRedis.__vdsRedisLastLog ??= {})
  const previous = lastLog[clientName] ?? 0

  if (now - previous < ERROR_LOG_INTERVAL_MS) return
  lastLog[clientName] = now

  const isRefused =
    'code' in error && (error as NodeJS.ErrnoException).code === 'ECONNREFUSED'

  if (isRefused) {
    // A refused connection is an expected, handled state — the circuit breaker
    // has already switched to the in-process fallback and the site is serving
    // normally. Logging it at ERROR paints the terminal red for a condition
    // nothing is wrong with; WARN says "notice this" without crying wolf.
    logger.warn(
      { client: clientName },
      'Redis not running — using the in-process cache and limiter. ' +
        'Optional in development; to run a real one: brew services start redis',
    )
  } else {
    logger.error({ err: error, client: clientName }, 'redis connection error')
  }
}

function create(name: string, options: RedisOptions): RedisClient {
  const client = new Redis(getEnv().REDIS_URL, options)
  client.on('error', (error: Error) => {
    markDown()
    logConnectionError(name, error)
  })
  client.on('ready', markUp)
  return client
}

export function getRedis(): RedisClient {
  if (!globalForRedis.__vdsRedis) {
    globalForRedis.__vdsRedis = create('app', {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: false,
      // Fail immediately instead of parking the command until a connection
      // appears — an absent Redis must cost a render nothing, not seconds.
      enableOfflineQueue: false,
      connectTimeout: 1_000,
      // Back off quickly rather than hammering a socket that is not there.
      retryStrategy: (attempt) => Math.min(attempt * 500, 10_000),
    })
  }
  return globalForRedis.__vdsRedis
}

/** Connection for BullMQ queues and workers. */
export function getQueueRedis(): RedisClient {
  if (!globalForRedis.__vdsRedisQueue) {
    globalForRedis.__vdsRedisQueue = create('queue', {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
  }
  return globalForRedis.__vdsRedisQueue
}

/**
 * Process-local fallback cache.
 *
 * Used only when Redis is unreachable, so that a developer without Redis
 * running still gets a working site instead of a database query on every
 * render. It is intentionally *not* a substitute for Redis in production: it
 * is per-process, so several instances would disagree, and it is bounded.
 */
const memoryCache = new Map<string, { value: string; expiresAt: number }>()
const MEMORY_CACHE_MAX_ENTRIES = 500

function memorySet(key: string, value: string, ttlSeconds: number): void {
  if (memoryCache.size >= MEMORY_CACHE_MAX_ENTRIES) {
    const oldest = memoryCache.keys().next()
    if (!oldest.done) memoryCache.delete(oldest.value)
  }
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
}

function memoryGet(key: string): string | null {
  const hit = memoryCache.get(key)
  if (!hit) return null
  if (hit.expiresAt <= Date.now()) {
    memoryCache.delete(key)
    return null
  }
  return hit.value
}

/**
 * Cache read-through helper. A Redis failure is bypassed — caching must never
 * be the reason a page fails to render.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  produce: () => Promise<T>,
): Promise<T> {
  if (redisAvailable()) {
    try {
      const hit = await getRedis().get(key)
      if (hit) return JSON.parse(hit) as T
    } catch {
      const fallback = memoryGet(key)
      if (fallback) return JSON.parse(fallback) as T
    }
  } else {
    const fallback = memoryGet(key)
    if (fallback) return JSON.parse(fallback) as T
  }

  const value = await produce()
  const serialized = JSON.stringify(value)

  if (redisAvailable()) {
    try {
      await getRedis().set(key, serialized, 'EX', ttlSeconds)
    } catch {
      memorySet(key, serialized, ttlSeconds)
    }
  } else {
    memorySet(key, serialized, ttlSeconds)
  }
  return value
}

/** Invalidate every key under a prefix. Used by content publish hooks. */
export async function invalidatePrefix(prefix: string): Promise<number> {
  for (const key of [...memoryCache.keys()]) {
    if (key.startsWith(prefix)) memoryCache.delete(key)
  }

  let cursor = '0'
  let removed = 0
  try {
    const redis = getRedis()
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 250)
      cursor = next
      if (keys.length > 0) removed += await redis.del(...keys)
    } while (cursor !== '0')
  } catch {
    // The in-memory entries are already gone; nothing further to do.
  }
  return removed
}

/** True when Redis answered a ping. Used by the readiness probe and doctor. */
export async function isRedisReachable(): Promise<boolean> {
  try {
    await getRedis().ping()
    return true
  } catch {
    return false
  }
}
