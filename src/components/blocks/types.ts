import type { Locale } from '@/i18n/config'
import type { ResolvedBlock } from '@/server/modules/pages/service'

/**
 * Block contract.
 *
 * A block receives its merged props and the rendering locale. New block types
 * are added by writing a component and registering it — no schema migration,
 * no change to the page renderer (§32).
 */
export interface BlockProps {
  block: ResolvedBlock
  locale: Locale
}

export type BlockComponent = (
  props: BlockProps,
) => React.ReactNode | Promise<React.ReactNode>

/** Reads a string prop with a safe default. */
export function stringProp(
  props: Record<string, unknown>,
  key: string,
  fallback = '',
): string {
  const value = props[key]
  return typeof value === 'string' ? value : fallback
}

export function stringArrayProp(props: Record<string, unknown>, key: string): string[] {
  const value = props[key]
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : []
}

export function numberProp(
  props: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = props[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function booleanProp(
  props: Record<string, unknown>,
  key: string,
  fallback = false,
): boolean {
  const value = props[key]
  return typeof value === 'boolean' ? value : fallback
}

export function recordArrayProp(
  props: Record<string, unknown>,
  key: string,
): Record<string, unknown>[] {
  const value = props[key]
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && !Array.isArray(item),
  )
}
