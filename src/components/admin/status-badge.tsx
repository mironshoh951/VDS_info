import { Badge } from '@/components/ui'
import type { ContentStatus, TranslationStatus } from '@/server/db/generated/enums'

const STATUS_VARIANT: Record<ContentStatus, 'neutral' | 'brand' | 'success' | 'warning'> =
  {
    DRAFT: 'neutral',
    REVIEW: 'warning',
    SCHEDULED: 'brand',
    PUBLISHED: 'success',
    ARCHIVED: 'neutral',
  }

const STATUS_LABEL: Record<ContentStatus, string> = {
  DRAFT: 'Draft',
  REVIEW: 'In review',
  SCHEDULED: 'Scheduled',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
}

export function StatusBadge({ status }: { status: ContentStatus | null }) {
  if (!status) return null
  return (
    <Badge variant={STATUS_VARIANT[status]} size="sm">
      {STATUS_LABEL[status]}
    </Badge>
  )
}

/**
 * Per-locale translation state, shown as four small squares.
 *
 * A compact indicator beats four badges: on a list of 25 rows the reader is
 * scanning for gaps, not reading labels. The title attribute and the
 * screen-reader text carry the detail.
 */
const TRANSLATION_STYLE: Record<
  TranslationStatus | 'ABSENT',
  { className: string; label: string }
> = {
  APPROVED: { className: 'bg-success-500', label: 'approved' },
  HUMAN_DRAFT: { className: 'bg-info-500', label: 'draft' },
  AI_DRAFT: { className: 'bg-warning-500', label: 'AI draft, needs review' },
  OUTDATED: { className: 'bg-accent-500', label: 'outdated' },
  MISSING: { className: 'bg-neutral-200', label: 'missing' },
  ABSENT: { className: 'bg-neutral-200', label: 'missing' },
}

export function TranslationDots({
  translations,
  locales,
}: {
  translations: Partial<Record<string, TranslationStatus>>
  locales: readonly string[]
}) {
  return (
    <span className="flex items-center gap-1">
      {locales.map((locale) => {
        const status = translations[locale] ?? 'ABSENT'
        const style = TRANSLATION_STYLE[status]
        return (
          <span
            key={locale}
            className={`inline-block h-2.5 w-2.5 rounded-[2px] ${style.className}`}
            title={`${locale.toUpperCase()}: ${style.label}`}
          >
            <span className="sr-only">
              {locale.toUpperCase()}: {style.label}
            </span>
          </span>
        )
      })}
    </span>
  )
}
