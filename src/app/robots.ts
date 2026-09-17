import type { MetadataRoute } from 'next'
import { getSettings } from '@/server/modules/settings/service'
import { logger } from '@/lib/logger'

/**
 * robots.txt (§38).
 *
 * Indexing is opt-in. Until a Super Admin enables it for launch, every crawler
 * is disallowed — which is what prevents a staging or pre-launch deployment
 * from being indexed and then having to be de-indexed.
 *
 * The admin host is never mentioned here. robots.txt is public, and listing an
 * administrative path in it advertises exactly what it is meant to keep quiet.
 */
export const revalidate = 3600

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    '',
  )

  let allowIndexing = false
  try {
    const seo = await getSettings('site.seo')
    allowIndexing = seo.robotsAllowIndexing
  } catch (error) {
    logger.error({ err: error }, 'robots settings unavailable; defaulting to disallow')
  }

  if (!allowIndexing) {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Search result pages are infinite and duplicate real content.
        disallow: ['/*/search', '/api/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
