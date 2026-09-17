'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Globe } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { LOCALES } from '@/i18n/config'

/**
 * Interface language control.
 *
 * The chosen language is a cookie the server reads while rendering, so setting
 * it is only half the job: the layout that is already on screen was rendered
 * from the previous value and will not change on its own. `router.refresh()`
 * is what makes the new language appear, and it has to run after the action
 * has resolved — otherwise the refresh races the cookie write and re-renders
 * the old language.
 */
export function AdminLocaleSwitcher({
  current,
  action,
}: {
  current: string
  action: (formData: FormData) => Promise<void>
}) {
  const t = useTranslations('admin.language')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <div className="relative">
      <label htmlFor="admin-locale" className="sr-only">
        {t('label')}
      </label>
      <Globe
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-neutral-400"
      />
      <select
        id="admin-locale"
        name="locale"
        defaultValue={current}
        disabled={pending}
        onChange={(event) => {
          const data = new FormData()
          data.append('locale', event.currentTarget.value)
          startTransition(async () => {
            await action(data)
            router.refresh()
          })
        }}
        className="cursor-pointer appearance-none rounded-md border border-[var(--border-subtle)] bg-white py-2 pr-7 pl-8 text-sm text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:opacity-60"
      >
        {LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {t(locale)}
          </option>
        ))}
      </select>
    </div>
  )
}
