import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

/**
 * Listing and detail page header, with breadcrumbs.
 *
 * The breadcrumb is a real `<nav>` with an ordered list and `aria-current` on
 * the final item — search engines read it as a trail (§38) and screen readers
 * announce position in the hierarchy.
 */
export interface Crumb {
  label: string
  href?: string
}

export function PageHeader({
  eyebrow,
  title,
  description,
  crumbs,
  aside,
}: {
  eyebrow?: string | null
  title: string
  description?: string | null
  crumbs?: Crumb[]
  aside?: React.ReactNode
}) {
  return (
    <header className="from-primary-50/60 border-b border-[var(--border-subtle)] bg-gradient-to-b to-white">
      <div className="content-container py-10 md:py-14">
        {crumbs && crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-neutral-500">
              {crumbs.map((crumb, index) => {
                const isLast = index === crumbs.length - 1
                return (
                  <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                    {index > 0 && (
                      <ChevronRight
                        className="h-3.5 w-3.5 text-neutral-400"
                        aria-hidden="true"
                      />
                    )}
                    {crumb.href && !isLast ? (
                      <Link
                        href={crumb.href}
                        className="hover:text-primary-800 hover:underline"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span
                        aria-current={isLast ? 'page' : undefined}
                        className="text-neutral-700"
                      >
                        {crumb.label}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>
        )}

        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            {eyebrow && (
              <p className="text-primary-600 mb-3 text-sm font-semibold tracking-[0.12em] uppercase">
                {eyebrow}
              </p>
            )}
            <h1 className="text-primary-950 text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
              {title}
            </h1>
            {description && (
              <p className="mt-4 text-base leading-relaxed text-neutral-600">
                {description}
              </p>
            )}
          </div>
          {aside && <div className="shrink-0">{aside}</div>}
        </div>
      </div>
    </header>
  )
}
