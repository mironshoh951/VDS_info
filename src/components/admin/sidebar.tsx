'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import * as Icons from 'lucide-react'
import { cn } from '@/lib/cn'
import { ADMIN_NAV } from './nav-config'
import type { Capability } from '@/server/auth/capabilities'

/**
 * Administration sidebar.
 *
 * Sections whose items are all unavailable to the current role disappear
 * entirely rather than rendering an empty heading. Hiding is presentation
 * only — every page and endpoint re-checks the capability server-side.
 */
export function AdminSidebar({
  capabilities,
  counts,
}: {
  capabilities: Capability[]
  counts: { inquiries: number }
}) {
  const pathname = usePathname()
  const t = useTranslations('admin')
  const allowed = new Set(capabilities)

  return (
    <nav
      aria-label={t('shell.navigation')}
      // `min-h-0` is what makes the scroll work: a flex child defaults to a
      // minimum size of its content, so without it the nav grows to fit every
      // item and pushes past the sidebar instead of scrolling inside it.
      className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-3 py-5"
    >
      {ADMIN_NAV.map((section) => {
        const items = section.items.filter((item) => allowed.has(item.capability))
        if (items.length === 0) return null

        return (
          <div key={section.key}>
            <h2 className="text-2xs px-3 pb-2 font-semibold tracking-[0.1em] text-neutral-400 uppercase">
              {t(`sections.${section.key}`)}
            </h2>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                const Icon = (Icons[item.icon as keyof typeof Icons] ??
                  Icons.Circle) as React.ComponentType<{ className?: string }>
                const badgeCount = item.badge === 'inquiries' ? counts.inquiries : 0

                if (item.planned) {
                  return (
                    <li key={item.href}>
                      <span
                        aria-disabled="true"
                        title={t('shell.plannedHint')}
                        className="flex cursor-default items-center gap-2.5 rounded-md px-3 py-2 text-sm text-neutral-400"
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 truncate">{t(`nav.${item.key}`)}</span>
                        <span className="text-2xs rounded-full bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-500">
                          {t('shell.planned')}
                        </span>
                      </span>
                    </li>
                  )
                }

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
                        active
                          ? 'bg-primary-50 text-primary-800 font-medium'
                          : 'text-neutral-700 hover:bg-neutral-100',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{t(`nav.${item.key}`)}</span>
                      {badgeCount > 0 && (
                        <span className="bg-primary-600 text-2xs rounded-full px-1.5 py-0.5 font-semibold text-white">
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}
