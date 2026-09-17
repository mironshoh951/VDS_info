import { NextResponse, type NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'
import { createNonce, securityHeaders } from '@/server/security/headers'

/**
 * Edge proxy (the Next.js 16 replacement for `middleware.ts`).
 *
 * Three jobs, in this order:
 *
 *  1. **Host separation (§4, §81).** The admin application lives on its own
 *     host. On the public host every admin path returns 404 — not a redirect,
 *     not a 403, which would confirm that something is there.
 *  2. **Security headers (§10.1)** including a per-request CSP nonce.
 *  3. **Locale routing** for the public site only; admin is single-locale by
 *     interface language preference, not by URL.
 *
 * Runs on the edge runtime: no database, no Redis, no secrets beyond the host
 * configuration.
 */

/**
 * Internal path the admin application lives at inside the app router. The
 * public host returns 404 for anything under it; the admin host rewrites "/"
 * onto it. Note it cannot begin with an underscore — Next treats `_`-prefixed
 * folders as private and excludes them from routing entirely.
 */
const ADMIN_PATH_PREFIX = '/admin'

const intlMiddleware = createIntlMiddleware(routing)

function normalizeHost(value: string | null): string {
  return (value ?? '').toLowerCase().split(':')[0] ?? ''
}

function mediaOrigins(): string[] {
  // The local driver serves media from this same origin, which 'self' already
  // covers; adding a dead object-store origin to the CSP only adds noise.
  if ((process.env.MEDIA_DRIVER ?? 'local') !== 's3') return []
  const base = process.env.S3_PUBLIC_BASE_URL
  if (!base) return []
  try {
    return [new URL(base).origin]
  } catch {
    return []
  }
}

function isAdminRequest(request: NextRequest): boolean {
  const adminHost = normalizeHost(process.env.ADMIN_HOST ?? '')
  const requestHost = normalizeHost(request.headers.get('host'))

  if (adminHost && requestHost === adminHost) return true

  // Development convenience only. Must be disabled in production.
  if (
    process.env.ADMIN_PATH_FALLBACK === 'true' &&
    process.env.NODE_ENV !== 'production' &&
    request.nextUrl.pathname.startsWith(ADMIN_PATH_PREFIX)
  ) {
    return true
  }

  return false
}

export default function proxy(request: NextRequest): NextResponse {
  const nonce = createNonce()
  const isDevelopment = process.env.NODE_ENV !== 'production'
  const admin = isAdminRequest(request)
  const { pathname } = request.nextUrl

  // The public host must not acknowledge the admin surface at all.
  if (!admin && pathname.startsWith(ADMIN_PATH_PREFIX)) {
    return new NextResponse(null, { status: 404 })
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set(
    'x-request-id',
    request.headers.get('x-request-id') ?? crypto.randomUUID(),
  )
  requestHeaders.set('x-surface', admin ? 'admin' : 'public')

  let response: NextResponse

  if (admin) {
    // Admin paths are rewritten under a route group that never sees a locale
    // segment, so an admin URL is stable regardless of interface language.
    const url = request.nextUrl.clone()
    if (!pathname.startsWith(ADMIN_PATH_PREFIX)) {
      url.pathname = `${ADMIN_PATH_PREFIX}${pathname === '/' ? '' : pathname}`
      response = NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    } else {
      response = NextResponse.next({ request: { headers: requestHeaders } })
    }
  } else {
    response = intlMiddleware(request)
    // next-intl may return a redirect or rewrite; either way we still want our
    // headers on it, and the nonce forwarded to the render.
    const forwarded = new NextResponse(response.body, response)
    forwarded.headers.set('x-nonce', nonce)
    response = forwarded
  }

  for (const [name, value] of Object.entries(
    securityHeaders({
      nonce,
      isAdmin: admin,
      isDevelopment,
      mediaOrigins: mediaOrigins(),
    }),
  )) {
    response.headers.set(name, value)
  }

  response.headers.set('x-request-id', requestHeaders.get('x-request-id') ?? '')

  return response
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals, static assets and files with an
     * extension. Health checks are excluded so a probe is never redirected.
     */
    '/((?!api/health|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
}
