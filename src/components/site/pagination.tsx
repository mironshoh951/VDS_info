import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Pagination.
 *
 * Rendered as real links rather than buttons, so a page is shareable,
 * bookmarkable, crawlable and works without JavaScript. `rel="prev"/"next"`
 * tells crawlers how the sequence fits together.
 */
export function Pagination({
  page,
  totalPages,
  buildHref,
  labels,
}: {
  page: number
  totalPages: number
  buildHref: (page: number) => string
  labels: { previous: string; next: string; page: string }
}) {
  if (totalPages <= 1) return null

  const windowSize = 2
  const pages: Array<number | 'gap'> = []

  for (let candidate = 1; candidate <= totalPages; candidate += 1) {
    const isEdge = candidate === 1 || candidate === totalPages
    const isNear = Math.abs(candidate - page) <= windowSize
    if (isEdge || isNear) {
      pages.push(candidate)
    } else if (pages[pages.length - 1] !== 'gap') {
      pages.push('gap')
    }
  }

  const linkClass = (active: boolean) =>
    cn(
      'inline-flex h-10 min-w-10 items-center justify-center rounded-md px-3 text-sm font-medium',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
      active
        ? 'bg-primary-700 text-white'
        : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-50',
    )

  return (
    <nav
      aria-label={labels.page}
      className="mt-12 flex items-center justify-center gap-2"
    >
      {page > 1 ? (
        <Link href={buildHref(page - 1)} rel="prev" className={linkClass(false)}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only sm:ml-1">{labels.previous}</span>
        </Link>
      ) : (
        <span
          className={cn(linkClass(false), 'pointer-events-none opacity-40')}
          aria-hidden="true"
        >
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}

      <ul className="flex items-center gap-1">
        {pages.map((entry, index) =>
          entry === 'gap' ? (
            <li key={`gap-${index}`} className="px-1 text-neutral-400" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={entry}>
              <Link
                href={buildHref(entry)}
                className={linkClass(entry === page)}
                aria-current={entry === page ? 'page' : undefined}
              >
                {entry}
              </Link>
            </li>
          ),
        )}
      </ul>

      {page < totalPages ? (
        <Link href={buildHref(page + 1)} rel="next" className={linkClass(false)}>
          <span className="sr-only sm:not-sr-only sm:mr-1">{labels.next}</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : (
        <span
          className={cn(linkClass(false), 'pointer-events-none opacity-40')}
          aria-hidden="true"
        >
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  )
}
