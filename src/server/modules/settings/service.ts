import type { z } from 'zod'
import { db } from '@/server/db/client'
import { cached, invalidatePrefix } from '@/server/cache/redis'
import { logger } from '@/lib/logger'
import { recordAudit } from '@/server/security/audit'
import { authorize, type StepUpReceipt } from '@/server/auth/guard'
import { actorId, actorLabel, actorRole, type Actor } from '@/server/auth/actor'
import { settingsRegistry, isKnownSetting, type SettingsNamespace } from './registry'
import { validationFailed } from '@/lib/errors'
import type { Locale } from '@/i18n/config'

/**
 * Reading and writing site settings.
 *
 * Reads are cached and always fall back to the registry default, so a missing
 * row or an unreachable database degrades to a sensible value rather than an
 * exception in a layout component.
 *
 * Writes require `settings.manage` and step-up re-authentication, and are
 * audited with a before/after diff.
 */

const CACHE_PREFIX = 'settings:'
const CACHE_TTL_SECONDS = 120

type Registry = typeof settingsRegistry

/**
 * Value types are derived from each setting's Zod schema, not from its default.
 * Deriving from the default would give literal types (`""`, `false`), which
 * TypeScript then narrows to `never` inside an ordinary truthiness check —
 * a subtle trap that would make every `if (settings.x)` unusable.
 */
type NamespaceValues<N extends SettingsNamespace> = {
  [K in keyof Registry[N]]: Registry[N][K] extends { schema: z.ZodType<infer T> }
    ? T
    : never
}

function defaultsFor<N extends SettingsNamespace>(namespace: N): NamespaceValues<N> {
  const entries = Object.entries(
    settingsRegistry[namespace] as Record<string, { default: unknown }>,
  )
  return Object.fromEntries(
    entries.map(([key, meta]) => [key, meta.default]),
  ) as NamespaceValues<N>
}

/**
 * Returns every setting in a namespace, merged over the registry defaults.
 * `locale` selects the localized variant where a setting declares one.
 */
export async function getSettings<N extends SettingsNamespace>(
  namespace: N,
  locale?: Locale,
): Promise<NamespaceValues<N>> {
  const cacheKey = `${CACHE_PREFIX}${namespace}:${locale ?? '-'}`

  try {
    return await cached(cacheKey, CACHE_TTL_SECONDS, async () => {
      const rows = await db.siteSetting.findMany({
        where: { namespace },
        select: { key: true, value: true, localized: true },
      })

      const result = defaultsFor(namespace) as Record<string, unknown>

      for (const row of rows) {
        if (!isKnownSetting(namespace, row.key)) continue

        const localizedValue =
          locale && row.localized && typeof row.localized === 'object'
            ? (row.localized as Record<string, unknown>)[locale]
            : undefined

        result[row.key] = localizedValue ?? row.value
      }

      return result as NamespaceValues<N>
    })
  } catch (error) {
    logger.error({ err: error, namespace }, 'settings read failed; using defaults')
    return defaultsFor(namespace)
  }
}

export async function getSetting<
  N extends SettingsNamespace,
  K extends keyof Registry[N] & string,
>(namespace: N, key: K, locale?: Locale): Promise<NamespaceValues<N>[K]> {
  const values = await getSettings(namespace, locale)
  return values[key]
}

export interface UpdateSettingInput {
  namespace: SettingsNamespace
  key: string
  value: unknown
  /** Localized overrides keyed by locale, for settings that declare `localized`. */
  localized?: Partial<Record<Locale, unknown>>
  challengeToken?: string | null
  /**
   * A step-up already consumed by the caller in this request. Used by the
   * group save, where one confirmation covers several settings and the token
   * itself can only be spent once.
   */
  stepUp?: StepUpReceipt
}

export async function updateSetting(
  actor: Actor,
  input: UpdateSettingInput,
): Promise<{ receipt: StepUpReceipt | null }> {
  const { receipt } = await authorize(actor, 'settings.manage', {
    scope: 'security.settings',
    challengeToken: input.challengeToken ?? null,
    ...(input.stepUp ? { stepUp: input.stepUp } : {}),
    entityType: 'SITE_SETTING',
    entityId: `${input.namespace}.${input.key}`,
  })
  const stepUpUsed = receipt !== null

  const definition = (
    settingsRegistry as Record<
      string,
      Record<
        string,
        {
          schema: {
            safeParse: (v: unknown) => {
              success: boolean
              data?: unknown
              error?: { issues: { path: PropertyKey[]; message: string }[] }
            }
          }
        }
      >
    >
  )[input.namespace]?.[input.key]

  if (!definition) {
    throw validationFailed([
      { field: 'key', code: 'unknown_setting', message: 'That setting does not exist.' },
    ])
  }

  const parsed = definition.schema.safeParse(input.value)
  if (!parsed.success) {
    throw validationFailed(
      (parsed.error?.issues ?? []).map((issue) => ({
        field: issue.path.join('.') || input.key,
        code: 'invalid',
        message: issue.message,
      })),
    )
  }

  const before = await db.siteSetting.findUnique({
    where: { namespace_key: { namespace: input.namespace, key: input.key } },
    select: { value: true, localized: true },
  })

  const after = await db.siteSetting.upsert({
    where: { namespace_key: { namespace: input.namespace, key: input.key } },
    create: {
      namespace: input.namespace,
      key: input.key,
      value: parsed.data as object,
      localized: (input.localized ?? undefined) as object | undefined,
      updatedById: actorId(actor),
    },
    update: {
      value: parsed.data as object,
      localized: (input.localized ?? undefined) as object | undefined,
      updatedById: actorId(actor),
    },
    select: { value: true, localized: true },
  })

  await invalidatePrefix(`${CACHE_PREFIX}${input.namespace}`)

  await recordAudit({
    actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
    action: 'settings.updated',
    entityType: 'SITE_SETTING',
    entityId: `${input.namespace}.${input.key}`,
    entityLabel: `${input.namespace}.${input.key}`,
    before,
    after,
    context: {
      ip: 'ip' in actor ? actor.ip : null,
      userAgent: 'userAgent' in actor ? actor.userAgent : null,
      requestId: actor.requestId,
      stepUpUsed,
    },
  })

  return { receipt }
}

/** Convenience for layouts: the locale configuration the site is running with. */
export async function getLocaleSettings(): Promise<{
  defaultLocale: Locale
  enabledLocales: Locale[]
  publishAiDrafts: boolean
}> {
  const values = await getSettings('site.i18n')
  return {
    defaultLocale: values.defaultLocale as Locale,
    enabledLocales: [...(values.enabledLocales as readonly Locale[])],
    publishAiDrafts: values.publishAiDrafts as boolean,
  }
}
