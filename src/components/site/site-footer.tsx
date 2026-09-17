import Link from 'next/link'
import { getNavigation } from '@/server/modules/navigation/service'
import { getSettings } from '@/server/modules/settings/service'
import { db } from '@/server/db/client'
import type { Locale } from '@/i18n/config'

/**
 * Site footer.
 *
 * Navigation columns, contact details and social links are all database-backed
 * (§42, §43, §79). Nothing here is hardcoded, including the copyright name,
 * which uses the configured legal name when one exists.
 */
export async function SiteFooter({
  locale,
  defaultLocale,
}: {
  locale: Locale
  defaultLocale: Locale
}) {
  const [primary, secondary, legal, general, contact, socialLinks] = await Promise.all([
    getNavigation('FOOTER_PRIMARY', locale, defaultLocale),
    getNavigation('FOOTER_SECONDARY', locale, defaultLocale),
    getNavigation('FOOTER_LEGAL', locale, defaultLocale),
    getSettings('site.general', locale),
    getSettings('site.contact', locale),
    db.socialLink
      .findMany({
        where: { visible: true, partnerId: null, brandId: null, teamMemberId: null },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, platform: true, url: true, label: true },
      })
      .catch(() => []),
  ])

  const year = new Date().getFullYear()
  const owner = general.legalName || general.siteName

  return (
    <footer className="mt-20 border-t border-[var(--border-subtle)] bg-[var(--surface-subtle)]">
      <div className="content-container py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            {general.siteName && (
              <p className="text-primary-900 text-base font-semibold">
                {general.siteName}
              </p>
            )}
            {general.tagline && (
              <p className="max-w-xs text-sm leading-relaxed text-neutral-600">
                {general.tagline}
              </p>
            )}
          </div>

          <FooterColumn items={primary} />
          <FooterColumn items={secondary} />

          <div className="space-y-2 text-sm text-neutral-600">
            {contact.primaryEmail && (
              <p>
                <a
                  className="hover:text-primary-800 hover:underline"
                  href={`mailto:${contact.primaryEmail}`}
                >
                  {contact.primaryEmail}
                </a>
              </p>
            )}
            {contact.primaryPhone && (
              <p>
                <a
                  className="hover:text-primary-800 hover:underline"
                  href={`tel:${contact.primaryPhone.replace(/\s+/g, '')}`}
                >
                  {contact.primaryPhone}
                </a>
              </p>
            )}
            {socialLinks.length > 0 && (
              <ul className="flex flex-wrap gap-3 pt-2">
                {socialLinks.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary-800 text-sm text-neutral-600 hover:underline"
                    >
                      {link.label ?? link.platform}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-[var(--border-subtle)] pt-6 text-sm text-neutral-500 md:flex-row md:items-center md:justify-between">
          <p>{owner ? `© ${year} ${owner}` : `© ${year}`}</p>
          {legal.length > 0 && (
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {legal.map((item) => (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="hover:text-primary-800 hover:underline"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span>{item.label}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ items }: { items: Awaited<ReturnType<typeof getNavigation>> }) {
  if (items.length === 0) return <div />

  return (
    <nav>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.id}>
            {item.href ? (
              <Link
                href={item.href}
                className="hover:text-primary-800 text-sm text-neutral-600 hover:underline"
                {...(item.openInNewTab ? { target: '_blank' } : {})}
                {...(item.rel ? { rel: item.rel } : {})}
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-sm text-neutral-500">{item.label}</span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
