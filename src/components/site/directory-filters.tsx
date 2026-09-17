'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui'

/**
 * Generic filter sidebar for directory listings.
 *
 * Submits as a real form with a GET-style rebuild of the query string, so
 * every filtered view has its own shareable URL and works with the browser's
 * back button. Filtering that only lives in component state cannot be linked
 * to, bookmarked, or indexed.
 */

export interface FilterGroup {
  key: string
  label: string
  allLabel: string
  options: Array<{ value: string; label: string }>
}

export function DirectoryFilters({
  basePath,
  current,
  groups,
  toggles = [],
  labels,
}: {
  basePath: string
  current: Record<string, string | string[] | undefined>
  groups: FilterGroup[]
  toggles?: Array<{ key: string; label: string }>
  labels: { title: string; search: string; apply: string; clear: string }
}) {
  const router = useRouter()
  const initial = (key: string) => {
    const value = current[key]
    return typeof value === 'string' ? value : ''
  }

  const [values, setValues] = useState<Record<string, string>>(() => {
    const state: Record<string, string> = { q: initial('q') }
    for (const group of groups) state[group.key] = initial(group.key)
    for (const toggle of toggles) state[toggle.key] = initial(toggle.key)
    return state
  })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(values)) {
      if (value) search.set(key, value)
    }
    const suffix = search.toString()
    router.push(suffix ? `${basePath}?${suffix}` : basePath)
  }

  const clear = () => {
    setValues({})
    router.push(basePath)
  }

  const hasFilters = Object.values(values).some(Boolean)

  return (
    <form onSubmit={submit} className="space-y-6 lg:sticky lg:top-24 lg:self-start">
      <h2 className="text-sm font-semibold tracking-wider text-neutral-500 uppercase">
        {labels.title}
      </h2>

      <div>
        <label
          htmlFor="filter-q"
          className="mb-1.5 block text-sm font-medium text-neutral-700"
        >
          {labels.search}
        </label>
        <input
          id="filter-q"
          type="search"
          value={values.q ?? ''}
          onChange={(event) => setValues((prev) => ({ ...prev, q: event.target.value }))}
          className="h-11 w-full rounded-md border border-neutral-300 px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        />
      </div>

      {groups.map((group) => (
        <div key={group.key}>
          <label
            htmlFor={`filter-${group.key}`}
            className="mb-1.5 block text-sm font-medium text-neutral-700"
          >
            {group.label}
          </label>
          <select
            id={`filter-${group.key}`}
            value={values[group.key] ?? ''}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, [group.key]: event.target.value }))
            }
            className="h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          >
            <option value="">{group.allLabel}</option>
            {group.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {toggles.map((toggle) => (
        <label
          key={toggle.key}
          className="flex items-center gap-2.5 text-sm text-neutral-700"
        >
          <input
            type="checkbox"
            checked={values[toggle.key] === '1'}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                [toggle.key]: event.target.checked ? '1' : '',
              }))
            }
            className="text-primary-600 h-4 w-4 rounded border-neutral-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          />
          {toggle.label}
        </label>
      ))}

      <div className="flex gap-2 pt-2">
        <Button type="submit" size="sm">
          {labels.apply}
        </Button>
        {hasFilters && (
          <Button type="button" size="sm" variant="ghost" onClick={clear}>
            {labels.clear}
          </Button>
        )}
      </div>
    </form>
  )
}
