'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Moon, Sun } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { AdminTheme } from '@/server/admin/theme'

/**
 * Light/dark toggle.
 *
 * The theme lives in a cookie the server reads while rendering, so setting it
 * is only half the job — the page already on screen was built from the old
 * value. `router.refresh()` after the action resolves is what actually repaints
 * it, and it has to come after, or the refresh races the cookie write.
 */
export function AdminThemeSwitcher({
  current,
  action,
}: {
  current: AdminTheme
  action: (formData: FormData) => Promise<void>
}) {
  const t = useTranslations('admin.theme')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const next: AdminTheme = current === 'dark' ? 'light' : 'dark'
  const Icon = current === 'dark' ? Sun : Moon

  return (
    <button
      type="button"
      disabled={pending}
      title={t(next)}
      aria-label={t('switchTo', { theme: t(next) })}
      onClick={() => {
        const data = new FormData()
        data.append('theme', next)
        startTransition(async () => {
          await action(data)
          router.refresh()
        })
      }}
      className="rounded-md border border-[var(--border-subtle)] p-2 text-neutral-600 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:opacity-60"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  )
}
