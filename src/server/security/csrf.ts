import { createHmac } from 'node:crypto'
import { getEnv } from '@/lib/env'
import { randomToken, safeEqual } from '@/lib/ids'
import { forbidden } from '@/lib/errors'
import type { RequestContext } from './request-context'

/**
 * CSRF protection: three independent checks, all of which must pass for a
 * state-changing request.
 *
 *   1. SameSite=Lax cookies (set elsewhere) block most cross-site form posts.
 *   2. Origin / Sec-Fetch-Site verification rejects cross-site callers.
 *   3. A signed double-submit token ties the request to the session.
 *
 * Any one of these can be defeated in isolation by a browser quirk or a
 * misconfigured proxy; together they are robust.
 */

export const CSRF_COOKIE = '__Host-vds.csrf'
export const CSRF_HEADER = 'x-csrf-token'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function issueCsrfToken(sessionToken: string): string {
  const raw = randomToken(24)
  const signature = signToken(raw, sessionToken)
  return `${raw}.${signature}`
}

function signToken(raw: string, sessionToken: string): string {
  return createHmac('sha256', getEnv().SESSION_SECRET)
    .update(`${raw}:${sessionToken}`)
    .digest('base64url')
}

export function verifyCsrfToken(token: string | null, sessionToken: string): boolean {
  if (!token) return false
  const [raw, signature] = token.split('.')
  if (!raw || !signature) return false
  return safeEqual(signature, signToken(raw, sessionToken))
}

/**
 * Cross-site origin check. `Sec-Fetch-Site` is authoritative where the browser
 * sends it; `Origin` is the fallback for older clients.
 */
export function assertSameSite(context: RequestContext, method: string): void {
  if (SAFE_METHODS.has(method.toUpperCase())) return

  const { secFetchSite, origin, host } = context

  if (secFetchSite) {
    if (
      secFetchSite === 'same-origin' ||
      secFetchSite === 'same-site' ||
      secFetchSite === 'none'
    ) {
      // 'none' means a user-initiated navigation (e.g. typing a URL), which
      // cannot carry an attacker-controlled body.
      if (secFetchSite !== 'none') return
    } else {
      throw forbidden('Cross-site request rejected.')
    }
  }

  if (origin) {
    let originHost: string
    try {
      originHost = new URL(origin).host
    } catch {
      throw forbidden('Malformed origin.')
    }
    if (originHost !== host) {
      throw forbidden('Cross-site request rejected.')
    }
  }
}

export function assertCsrf(
  context: RequestContext,
  method: string,
  headerToken: string | null,
  cookieToken: string | null,
  sessionToken: string,
): void {
  if (SAFE_METHODS.has(method.toUpperCase())) return

  assertSameSite(context, method)

  if (!headerToken || !cookieToken || !safeEqual(headerToken, cookieToken)) {
    throw forbidden('Invalid or missing CSRF token.')
  }
  if (!verifyCsrfToken(headerToken, sessionToken)) {
    throw forbidden('Invalid CSRF token.')
  }
}
