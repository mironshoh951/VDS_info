import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/**
 * Hosts allowed to load dev-server assets.
 *
 * The panel is often opened from another machine on the office network, and
 * Next refuses cross-origin requests for `/_next/*` unless the host is listed.
 * The failure is quietly misleading: the HTML renders, the client bundle 404s,
 * and navigation stops working with no error on the page. Listing the host
 * fixes it. Development only — `next build` ignores this entirely.
 */
const devOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? '192.168.0.105')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)

const config: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: devOrigins,
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // Type errors must fail the build. Never relax this.
  typescript: { ignoreBuildErrors: false },

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [320, 480, 640, 768, 960, 1280, 1600, 1920],
    imageSizes: [64, 96, 128, 256, 384],
    remotePatterns: [
      // Only the S3 driver serves media from another origin. With the local
      // driver every image is same-origin under /media/*, and listing a dead
      // object-store host here would let a stale URL resolve to a private
      // address instead of failing loudly.
      ...(process.env.MEDIA_DRIVER === 's3' && process.env.S3_PUBLIC_BASE_URL
        ? [
            {
              protocol: new URL(process.env.S3_PUBLIC_BASE_URL).protocol.replace(
                ':',
                '',
              ) as 'http' | 'https',
              hostname: new URL(process.env.S3_PUBLIC_BASE_URL).hostname,
              port: new URL(process.env.S3_PUBLIC_BASE_URL).port,
              pathname: '/**',
            },
          ]
        : []),
    ],
  },

  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  serverExternalPackages: ['@node-rs/argon2', 'sharp', 'pino'],
}

export default withNextIntl(config)
