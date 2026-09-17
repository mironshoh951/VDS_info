import { randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import { getEnv } from '@/lib/env'

/**
 * Request metadata used by logging, auditing and rate limiting.
 *
 * The client IP is only taken from forwarding headers when `TRUST_PROXY` is
 * set. Trusting `X-Forwarded-For` unconditionally would let any caller forge
 * the identifier every rate limit and lockout is keyed on.
 */

export interface RequestContext {
  requestId: string
  ip: string
  userAgent: string
  host: string
  origin: string | null
  secFetchSite: string | null
  acceptLanguage: string | null
}

const UNKNOWN_IP = '0.0.0.0'

function firstForwardedIp(value: string | null): string | null {
  if (!value) return null
  const first = value.split(',')[0]?.trim()
  return first && first.length > 0 ? first : null
}

export async function getRequestContext(): Promise<RequestContext> {
  const h = await headers()
  const env = getEnv()

  const ip = env.TRUST_PROXY
    ? (firstForwardedIp(h.get('x-forwarded-for')) ??
      h.get('x-real-ip') ??
      h.get('cf-connecting-ip') ??
      UNKNOWN_IP)
    : UNKNOWN_IP

  return {
    requestId: h.get('x-request-id') ?? randomUUID(),
    ip,
    userAgent: h.get('user-agent') ?? 'unknown',
    host: h.get('host') ?? '',
    origin: h.get('origin'),
    secFetchSite: h.get('sec-fetch-site'),
    acceptLanguage: h.get('accept-language'),
  }
}

/** Same extraction for route handlers, which have the Request object directly. */
export function requestContextFrom(request: Request): RequestContext {
  const env = getEnv()
  const h = request.headers

  const ip = env.TRUST_PROXY
    ? (firstForwardedIp(h.get('x-forwarded-for')) ??
      h.get('x-real-ip') ??
      h.get('cf-connecting-ip') ??
      UNKNOWN_IP)
    : UNKNOWN_IP

  return {
    requestId: h.get('x-request-id') ?? randomUUID(),
    ip,
    userAgent: h.get('user-agent') ?? 'unknown',
    host: h.get('host') ?? new URL(request.url).host,
    origin: h.get('origin'),
    secFetchSite: h.get('sec-fetch-site'),
    acceptLanguage: h.get('accept-language'),
  }
}
