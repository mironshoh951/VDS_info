import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { isLocale, type Locale } from '@/i18n/config'
import { getLocaleSettings } from '@/server/modules/settings/service'
import type { LocaleContext } from './localize'

/**
 * The preamble every public page needs: validate the locale segment, check it
 * is enabled, register it for static rendering, and build the locale context
 * the query layer takes.
 *
 * Repeating those four lines in every route is how one of them eventually gets
 * forgotten and a disabled language becomes reachable by typing its URL.
 */
export async function preparePage(params: Promise<{ locale: string }>): Promise<{
  locale: Locale
  context: LocaleContext
}> {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const { defaultLocale, publishAiDrafts, enabledLocales } = await getLocaleSettings()
  if (!enabledLocales.includes(locale)) notFound()

  setRequestLocale(locale)

  return {
    locale,
    context: { locale, defaultLocale, publishAiDrafts },
  }
}

/** Normalises Next.js search params into plain strings. */
export function firstParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = searchParams[key]
  if (Array.isArray(value)) return value[0]
  return value
}

export function intParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
  fallback: number,
): number {
  const raw = firstParam(searchParams, key)
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
