'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { LOCALE_DESCRIPTORS, type Locale } from '@/i18n/config'
import { cn } from '@/lib/cn'

/**
 * Language switcher.
 *
 * Switching replaces the locale segment in place, so the visitor stays on the
 * page they were reading. It is a native <select> on purpose: it is keyboard
 * accessible, announced correctly by screen readers, and uses the platform
 * picker on mobile — a custom dropdown would be worse in all three respects
 * for no visual gain at this size.
 */
export function LocaleSwitcher({
  locale,
  enabledLocales,
  label,
}: {
  locale: Locale
  enabledLocales: Locale[]
  label: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  if (enabledLocales.length < 2) return null

  function handleChange(next: string) {
    const segments = pathname.split('/')
    // segments[0] is empty (leading slash); segments[1] is the current locale.
    segments[1] = next
    const target = segments.join('/') || `/${next}`
    startTransition(() => {
      router.replace(target)
      router.refresh()
    })
  }

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={locale}
        onChange={(event) => handleChange(event.target.value)}
        disabled={isPending}
        className={cn(
          'h-11 cursor-pointer appearance-none rounded-md border border-neutral-300 bg-white',
          'py-2 pr-8 pl-3 text-sm font-medium text-neutral-700',
          'hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2',
          'focus-visible:outline-[var(--focus-ring)] disabled:opacity-60',
        )}
      >
        {enabledLocales.map((code) => (
          <option key={code} value={code}>
            {LOCALE_DESCRIPTORS[code].nativeName}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-2.5 h-4 w-4 text-neutral-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  )
}
