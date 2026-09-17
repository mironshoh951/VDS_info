import Link from 'next/link'

/** Standard heading block for an administration screen. */
export function AdminPageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  breadcrumb?: { label: string; href: string }
}) {
  return (
    <header className="mb-6">
      {breadcrumb && (
        <Link
          href={breadcrumb.href}
          className="hover:text-primary-700 mb-2 inline-block text-sm text-neutral-500 hover:underline"
        >
          ← {breadcrumb.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            {title}
          </h1>
          {description && <p className="mt-1 text-sm text-neutral-600">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  )
}
