import { cn } from '@/lib/cn'

/**
 * Card surface used by every listing.
 *
 * `interactive` adds the hover treatment for cards that are entirely a link;
 * it is a separate prop rather than always-on so that non-clickable cards do
 * not imply affordance they do not have.
 *
 * `h-full w-full` is what keeps a grid of cards rectangular. The listings wrap
 * each card in a grid cell, and several of those cells are flex containers so
 * the card stretches to the row's height. A flex item, though, is sized by its
 * *content* unless told otherwise — so a product with a two-word name and no
 * description rendered as a narrow sliver beside full-width neighbours, and a
 * card with no footer stopped short of the row. Filling the cell is the card's
 * own responsibility, not something sixteen call sites should each remember.
 */
export function Card({
  className,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white',
        interactive &&
          'transition-shadow duration-[var(--duration-base)] ease-[var(--ease-out-soft)] focus-within:shadow-md hover:shadow-md',
        className,
      )}
      {...props}
    />
  )
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-1 flex-col gap-2 p-5', className)} {...props} />
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mt-auto flex items-center gap-3 border-t border-[var(--border-subtle)] px-5 py-3 text-sm text-neutral-600',
        className,
      )}
      {...props}
    />
  )
}

/**
 * Placeholder shown where an image has not been uploaded.
 *
 * A neutral, clearly-empty frame is the honest representation: a stock photo
 * would imply the company owns imagery it does not.
 */
export function ImagePlaceholder({
  label,
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center bg-neutral-100 text-neutral-400',
        className,
      )}
      aria-hidden="true"
    >
      <span className="text-2xs tracking-wider uppercase">{label ?? 'No image'}</span>
    </div>
  )
}
