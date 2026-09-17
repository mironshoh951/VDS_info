'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Status chips and a search box for an administration list.
 *
 * Filters live in the URL so a filtered view can be bookmarked and shared, and
 * so the browser's back button behaves the way an operator expects.
 */
export function ListFilters({
  counts,
  statuses,
}: {
  counts: Record<string, number>
  statuses: Array<{ value: string; label: string }>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')

  const currentStatus =
    params.get('status') ?? (params.get('trash') === '1' ? 'TRASH' : 'ALL')

  const go = (next: URLSearchParams) => {
    const suffix = next.toString()
    router.push(suffix ? `${pathname}?${suffix}` : pathname)
  }

  const selectStatus = (value: string) => {
    const next = new URLSearchParams(params.toString())
    next.delete('page')
    next.delete('trash')
    next.delete('status')
    if (value === 'TRASH') next.set('trash', '1')
    else if (value !== 'ALL') next.set('status', value)
    go(next)
  }

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const next = new URLSearchParams(params.toString())
    next.delete('page')
    if (query) next.set('q', query)
    else next.delete('q')
    go(next)
  }

  const clearSearch = () => {
    setQuery('')
    const next = new URLSearchParams(params.toString())
    next.delete('q')
    next.delete('page')
    go(next)
  }

  const chips = [
    { value: 'ALL', label: 'All' },
    ...statuses,
    { value: 'TRASH', label: 'Trash' },
  ]

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-1">
        {chips.map((chip) => {
          const count = counts[chip.value]
          const active = currentStatus === chip.value
          return (
            <button
              key={chip.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectStatus(chip.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
                active
                  ? 'bg-primary-700 font-medium text-white'
                  : 'text-neutral-600 hover:bg-neutral-100',
              )}
            >
              {chip.label}
              {typeof count === 'number' && (
                <span
                  className={cn(
                    'ml-1.5 tabular-nums',
                    active ? 'text-primary-100' : 'text-neutral-400',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <form onSubmit={submitSearch} role="search" className="relative ml-auto">
        <label htmlFor="admin-list-search" className="sr-only">
          Search
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400"
          aria-hidden="true"
        />
        <input
          id="admin-list-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search…"
          className="h-10 w-full rounded-md border border-neutral-300 bg-white pr-9 pl-9 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] sm:w-64"
        />
        {query && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear search"
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-neutral-400 hover:text-neutral-700"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </form>
    </div>
  )
}
