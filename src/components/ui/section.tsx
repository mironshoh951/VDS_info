import { cn } from '@/lib/cn'

/**
 * Consistent section rhythm across the public site.
 *
 * Vertical spacing is a single decision made here rather than by each block,
 * which is what keeps a page built from arbitrary CMS blocks looking composed
 * rather than assembled.
 */
export function Section({
  className,
  tone = 'default',
  children,
  id,
  ...props
}: React.HTMLAttributes<HTMLElement> & { tone?: 'default' | 'subtle' | 'brand' }) {
  return (
    <section
      id={id}
      className={cn(
        'py-14 md:py-20',
        tone === 'subtle' && 'bg-[var(--surface-subtle)]',
        tone === 'brand' && 'bg-primary-900 text-white',
        className,
      )}
      {...props}
    >
      <div className="content-container">{children}</div>
    </section>
  )
}

export function SectionHeader({
  heading,
  body,
  action,
  align = 'left',
  tone = 'default',
}: {
  heading: string
  body?: string | null
  action?: React.ReactNode
  align?: 'left' | 'center'
  tone?: 'default' | 'inverted'
}) {
  return (
    <div
      className={cn(
        'mb-9 flex flex-col gap-4 md:flex-row md:items-end md:justify-between',
        align === 'center' && 'md:flex-col md:items-center md:text-center',
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
        <h2
          className={cn(
            'text-2xl font-semibold tracking-tight md:text-3xl',
            tone === 'inverted' ? 'text-white' : 'text-neutral-900',
          )}
        >
          {heading}
        </h2>
        {body && (
          <p
            className={cn(
              'mt-3 text-base leading-relaxed',
              tone === 'inverted' ? 'text-primary-100' : 'text-neutral-600',
            )}
          >
            {body}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
