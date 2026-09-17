import { db } from '@/server/db/client'
import { cached, invalidatePrefix } from '@/server/cache/redis'
import { logger } from '@/lib/logger'

/**
 * Super Admin overrides for interface strings (§6.1, §50).
 *
 * Rows are keyed by (locale, namespace, key) and merged over the shipped
 * catalogue at request time. Cached for five minutes; saving an override
 * invalidates the cache immediately so an editor sees the change at once.
 */

const CACHE_PREFIX = 'ui-translations:'
const CACHE_TTL_SECONDS = 300

export type MessageTree = Record<string, unknown>

export async function getUiTranslationOverrides(
  locale: string,
): Promise<MessageTree | null> {
  try {
    return await cached(`${CACHE_PREFIX}${locale}`, CACHE_TTL_SECONDS, async () => {
      const rows = await db.uiTranslation.findMany({
        where: { locale },
        select: { namespace: true, key: true, value: true },
      })

      if (rows.length === 0) return null

      const tree: MessageTree = {}
      for (const row of rows) {
        const namespace = (tree[row.namespace] ??= {}) as MessageTree
        namespace[row.key] = row.value
      }
      return tree
    })
  } catch (error) {
    // The database being unreachable must not take the site's copy with it.
    logger.warn({ err: error, locale }, 'ui translation overrides unavailable')
    return null
  }
}

export async function invalidateUiTranslations(locale?: string): Promise<void> {
  await invalidatePrefix(locale ? `${CACHE_PREFIX}${locale}` : CACHE_PREFIX)
}
