import { getEnv } from '@/lib/env'

/**
 * Cookie naming and attributes.
 *
 * `__Host-` is the strongest prefix available: the browser refuses the cookie
 * unless it is Secure, has no Domain attribute and is scoped to "/". That is
 * exactly what keeps the admin cookie from being readable on the public host.
 * The prefix requires HTTPS, so plain-HTTP local development falls back to an
 * unprefixed name — the attributes themselves stay identical.
 */

function hostPrefixEnabled(): boolean {
  return getEnv().NODE_ENV === 'production'
}

export const SESSION_COOKIE = () =>
  hostPrefixEnabled() ? '__Host-vds.session' : 'vds.session'
export const CSRF_COOKIE_NAME = () =>
  hostPrefixEnabled() ? '__Host-vds.csrf' : 'vds.csrf'
export const LOCALE_COOKIE = 'vds.locale'
export const CONSENT_COOKIE = 'vds.consent'
export const VISITOR_COOKIE = 'vds.visitor'

export interface CookieAttributes {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax' | 'strict' | 'none'
  path: string
  maxAge?: number
  expires?: Date
}

export function sessionCookieAttributes(expiresAt: Date): CookieAttributes {
  return {
    httpOnly: true,
    secure: hostPrefixEnabled(),
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  }
}

/**
 * The CSRF token is deliberately readable by scripts — the double-submit
 * pattern requires the page to echo it back in a header.
 */
export function csrfCookieAttributes(expiresAt: Date): CookieAttributes {
  return {
    httpOnly: false,
    secure: hostPrefixEnabled(),
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  }
}

export function clearedCookieAttributes(): CookieAttributes {
  return {
    httpOnly: true,
    secure: hostPrefixEnabled(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  }
}
