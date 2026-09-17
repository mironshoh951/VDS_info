import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getNavigation } from '@/server/modules/navigation/service'
import { getSettings } from '@/server/modules/settings/service'
import { LocaleSwitcher } from './locale-switcher'
import { MobileNav } from './mobile-nav'
import { SiteThemeSwitcher } from './theme-switcher'
import { HeaderOverHero } from './header-over-hero'
import type { Locale } from '@/i18n/config'

/**
 * Site header.
 *
 * Every link comes from the `Menu`/`MenuItem` tables. There is deliberately no
 * fallback menu in code: an empty header means no menu has been configured
 * yet, which is a content task, not a code change (§3, §79).
 *
 * Note what is absent: no admin link, no login control, nothing that hints at
 * where the administration lives (§4, §81).
 */
export async function SiteHeader({
  locale,
  defaultLocale,
  enabledLocales,
}: {
  locale: Locale
  defaultLocale: Locale
  enabledLocales: Locale[]
}) {
  const [items, general, t] = await Promise.all([
    getNavigation('HEADER', locale, defaultLocale),
    getSettings('site.general', locale),
    getTranslations('common'),
  ])

  const siteName = general.siteName

  return (
    // Solid by default. `HeaderOverHero` makes it transparent only while it can
    // actually see a hero behind it — so with no hero, no JavaScript, or a
    // failed observer, the links stay readable.
    <header className="site-header sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="content-container flex h-18 items-center justify-between gap-6 py-3">
        <Link
          href={`/${locale}`}
          className="text-primary-900 flex items-center gap-3 rounded-sm text-lg font-semibold tracking-tight"
        >
          {siteName ? (
            siteName
          ) : (
            <span className="text-neutral-400">{/* Site name not configured */}—</span>
          )}
        </Link>

        <nav aria-label={t('menu')} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {items.map((item) => (
              <li key={item.id} className="group relative">
                <NavLink item={item} />
                {item.children.length > 0 && (
                  <ul className="invisible absolute top-full left-0 z-50 min-w-56 rounded-lg border border-[var(--border-subtle)] bg-white p-2 opacity-0 shadow-lg transition-opacity duration-[var(--duration-fast)] group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    {item.children.map((child) => (
                      <li key={child.id}>
                        <NavLink item={child} nested />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <LocaleSwitcher
            locale={locale}
            enabledLocales={enabledLocales}
            label={t('language')}
          />
          <SiteThemeSwitcher label={t('theme.toggle')} />
          <HeaderOverHero />
          <MobileNav items={items} menuLabel={t('menu')} closeLabel={t('close')} />
        </div>
      </div>
    </header>
  )
}

function NavLink({
  item,
  nested = false,
}: {
  item: {
    href: string | null
    label: string
    ariaLabel: string | null
    external: boolean
    openInNewTab: boolean
    rel: string | null
  }
  nested?: boolean
}) {
  const className = nested
    ? 'block rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 hover:text-primary-800'
    : 'inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 hover:text-primary-800'

  if (!item.href) {
    return <span className={className}>{item.label}</span>
  }

  const external = item.external
  const props = {
    className,
    ...(item.ariaLabel ? { 'aria-label': item.ariaLabel } : {}),
    ...(item.openInNewTab ? { target: '_blank' as const } : {}),
    ...(item.rel ? { rel: item.rel } : {}),
  }

  return external ? (
    <a href={item.href} {...props}>
      {item.label}
    </a>
  ) : (
    <Link href={item.href} {...props}>
      {item.label}
    </Link>
  )
}
