import { getRedis, redisAvailable } from '@/server/cache/redis'
import { logger } from '@/lib/logger'
import { rateLimited } from '@/lib/errors'

/**
 * Sliding-window rate limiting backed by Redis.
 *
 * The policy table is the single place limits are defined (§10.2), so a new
 * endpoint cannot quietly ship without one. If Redis is unreachable the
 * limiter fails **closed** for authentication endpoints and **open** for
 * ordinary reads — an outage must not lock the site, but it also must not
 * silently disable brute-force protection.
 */

export interface RateLimitPolicy {
  /** Requests permitted per window. */
  limit: number
  /** Window length in seconds. */
  windowSeconds: number
  /** When Redis is down: block (true) or allow (false). */
  failClosed: boolean
}

export const RATE_LIMITS = {
  'auth.login.ip': { limit: 5, windowSeconds: 900, failClosed: true },
  'auth.login.account': { limit: 5, windowSeconds: 900, failClosed: true },
  'auth.stepUp': { limit: 5, windowSeconds: 600, failClosed: true },
  'auth.mfa': { limit: 8, windowSeconds: 600, failClosed: true },
  'auth.passwordReset': { limit: 3, windowSeconds: 3600, failClosed: true },
  'public.form': { limit: 3, windowSeconds: 600, failClosed: true },
  'public.newsletter': { limit: 3, windowSeconds: 3600, failClosed: true },
  'public.ai.minute': { limit: 10, windowSeconds: 60, failClosed: true },
  'public.ai.day': { limit: 100, windowSeconds: 86_400, failClosed: true },
  'public.search': { limit: 30, windowSeconds: 60, failClosed: false },
  'public.api': { limit: 120, windowSeconds: 60, failClosed: false },
  'public.download': { limit: 60, windowSeconds: 60, failClosed: false },
  'admin.api': { limit: 300, windowSeconds: 60, failClosed: false },
  'admin.ai': { limit: 60, windowSeconds: 60, failClosed: true },
  'admin.upload': { limit: 60, windowSeconds: 60, failClosed: false },
} as const satisfies Record<string, RateLimitPolicy>

export type RateLimitKey = keyof typeof RATE_LIMITS

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
  limit: number
}

/**
 * Atomic sliding window: one Lua round-trip, so concurrent requests cannot
 * race past the limit.
 */
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local cutoff = now - window * 1000

redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)
local count = redis.call('ZCARD', key)

if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry = window
  if oldest[2] then
    retry = math.ceil((tonumber(oldest[2]) + window * 1000 - now) / 1000)
    if retry < 1 then retry = 1 end
  end
  return { 0, 0, retry }
end

redis.call('ZADD', key, now, now .. '-' .. math.random(100000))
redis.call('PEXPIRE', key, window * 1000)
return { 1, limit - count - 1, 0 }
`

/**
 * Process-local sliding window, used only when Redis is unreachable in local
 * development. It is not a substitute for the Redis limiter — it is per
 * process and lost on restart — but it keeps brute-force protection real on a
 * developer machine instead of forcing the choice between "no limiter" and
 * "cannot sign in at all". Production still fails closed.
 */
const memoryWindows = new Map<string, number[]>()

function memoryRateLimit(policy: RateLimitPolicy, key: string): RateLimitResult {
  const now = Date.now()
  const cutoff = now - policy.windowSeconds * 1000
  const hits = (memoryWindows.get(key) ?? []).filter((t) => t > cutoff)

  if (hits.length >= policy.limit) {
    const oldest = hits[0] as number
    memoryWindows.set(key, hits)
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((oldest + policy.windowSeconds * 1000 - now) / 1000),
      ),
      limit: policy.limit,
    }
  }

  hits.push(now)
  memoryWindows.set(key, hits)
  return {
    allowed: true,
    remaining: policy.limit - hits.length,
    retryAfterSeconds: 0,
    limit: policy.limit,
  }
}

export async function checkRateLimit(
  policyKey: RateLimitKey,
  identifier: string,
): Promise<RateLimitResult> {
  const policy: RateLimitPolicy = RATE_LIMITS[policyKey]
  const redisKey = `rl:${policyKey}:${identifier}`

  // Known-down Redis is not contacted at all — this runs on sign-in and on
  // every public form submission.
  if (!redisAvailable() && process.env.NODE_ENV === 'development') {
    return memoryRateLimit(policy, redisKey)
  }

  try {
    const result = (await getRedis().eval(
      SLIDING_WINDOW_SCRIPT,
      1,
      redisKey,
      Date.now().toString(),
      policy.windowSeconds.toString(),
      policy.limit.toString(),
    )) as [number, number, number]

    return {
      allowed: result[0] === 1,
      remaining: result[1],
      retryAfterSeconds: result[2],
      limit: policy.limit,
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      // Local development runs without Redis. Degrade to the process-local
      // limiter rather than locking the developer out of sign-in.
      logger.warn({ policyKey }, 'redis unavailable — using in-memory limiter')
      return memoryRateLimit(policy, redisKey)
    }

    logger.error(
      { err: error, policyKey, failClosed: policy.failClosed },
      'rate limiter unavailable',
    )
    return {
      allowed: !policy.failClosed,
      remaining: 0,
      retryAfterSeconds: policy.failClosed ? policy.windowSeconds : 0,
      limit: policy.limit,
    }
  }
}

/** Throws a typed 429 when the limit is exceeded. */
export async function enforceRateLimit(
  policyKey: RateLimitKey,
  identifier: string,
): Promise<void> {
  const result = await checkRateLimit(policyKey, identifier)
  if (!result.allowed) {
    throw rateLimited(result.retryAfterSeconds)
  }
}

/** Clears a limiter bucket — used after a successful login. */
export async function resetRateLimit(
  policyKey: RateLimitKey,
  identifier: string,
): Promise<void> {
  try {
    await getRedis().del(`rl:${policyKey}:${identifier}`)
  } catch (error) {
    logger.warn({ err: error, policyKey }, 'rate limit reset failed')
  }
}
