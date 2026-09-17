import { Button } from '@/components/ui'
import Link from 'next/link'

/**
 * Empty state (§78).
 *
 * Says what the screen is for and offers the one action that resolves it,
 * rather than showing a blank table that leaves the reader guessing whether
 * something is broken.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: { label: string; href: string }
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-white px-6 py-16 text-center">
      <h2 className="text-base font-semibold text-neutral-800">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">{description}</p>
      {action && (
        <Button asChild className="mt-6">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  )
}
