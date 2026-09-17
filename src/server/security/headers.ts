import { THEME_INIT_SCRIPT_HASH } from '@/lib/site-theme'

/**
 * Security headers (§10.1).
 *
 * The admin host gets a strictly tighter policy than the public site: framing
 * denied outright, no image or connect origins beyond self, and `no-store`
 * caching so an authenticated page is never written to a shared cache.
 */

export interface HeaderOptions {
  nonce: string
  isAdmin: boolean
  isDevelopment: boolean
  /** Origins that may serve media (CDN/S3). */
  mediaOrigins: string[]
}

/**
 * Per-request CSP nonce.
 *
 * Uses Web Crypto rather than `node:crypto` because this module is imported by
 * the edge middleware, where Node built-ins are unavailable.
 */
export function createNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

export function buildContentSecurityPolicy(options: HeaderOptions): string {
  const { nonce, isAdmin, isDevelopment, mediaOrigins } = options

  // Next.js injects inline bootstrap scripts; they carry our nonce.
  // `strict-dynamic` lets nonce-approved scripts load their own chunks without
  // opening the policy to arbitrary hosts.
  //
  // `'strict-dynamic'` makes host expressions such as `'self'` inert in any
  // browser that understands it, so nothing here can be loaded by URL alone —
  // only a nonce or a hash gets a script executed. The public theme bootstrap
  // is inline and cannot carry a per-request nonce without making every page
  // dynamic, so it is admitted by hash instead. The admin panel does not have
  // that script and does not get the allowance.
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    isAdmin ? '' : THEME_INIT_SCRIPT_HASH,
    isDevelopment ? "'unsafe-eval'" : '',
  ].filter(Boolean)

  const imgSrc = ["'self'", 'data:', 'blob:', ...mediaOrigins]
  const connectSrc = ["'self'", ...(isDevelopment ? ['ws:', 'wss:'] : [])]
  const frameSrc = isAdmin
    ? ["'none'"]
    : ["'self'", 'https://www.youtube-nocookie.com', 'https://player.vimeo.com']

  const directives: Array<[string, string[]]> = [
    ['default-src', ["'self'"]],
    ['base-uri', ["'self'"]],
    ['script-src', scriptSrc],
    // Tailwind ships a stylesheet; inline styles come from React style props.
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', imgSrc],
    ['font-src', ["'self'", 'data:']],
    ['connect-src', connectSrc],
    ['media-src', ["'self'", ...mediaOrigins]],
    ['frame-src', frameSrc],
    ['frame-ancestors', ["'none'"]],
    ['form-action', ["'self'"]],
    ['object-src', ["'none'"]],
    ['worker-src', ["'self'", 'blob:']],
    ['manifest-src', ["'self'"]],
  ]

  if (!isDevelopment) {
    directives.push(['upgrade-insecure-requests', []])
  }

  return directives
    .map(([name, values]) => (values.length > 0 ? `${name} ${values.join(' ')}` : name))
    .join('; ')
}

export function securityHeaders(options: HeaderOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Security-Policy': buildContentSecurityPolicy(options),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-site',
    'Permissions-Policy': [
      'accelerometer=()',
      'camera=()',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'payment=()',
      'usb=()',
      'interest-cohort=()',
    ].join(', '),
  }

  if (!options.isDevelopment) {
    headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload'
  }

  if (options.isAdmin) {
    // An authenticated admin response must never be cached anywhere.
    headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, private'
    headers['Pragma'] = 'no-cache'
    // The admin surface is never indexed, whatever a crawler is told elsewhere.
    headers['X-Robots-Tag'] = 'noindex, nofollow, noarchive, nosnippet'
  }

  return headers
}
