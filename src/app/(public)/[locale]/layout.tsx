import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { LOCALE_DESCRIPTORS, isLocale, type Locale } from '@/i18n/config'
import { getSettings, getLocaleSettings } from '@/server/modules/settings/service'
import { THEME_INIT_SCRIPT } from '@/lib/site-theme'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import '@/styles/globals.css'

/**
 * Root layout for the public website.
 *
 * The admin application has its own root layout in a separate route group, so
 * the two surfaces share no shell, no providers and no client bundle.
 */

/**
 * Deliberately no `generateStaticParams`.
 *
 * Prerendering every locale at build time would require a reachable database
 * during `next build`, which couples the build to infrastructure and breaks CI
 * on a machine without Postgres. Pages instead render on first request and are
 * then cached by their own `revalidate` value, with publish-time tag
 * invalidation making edits appear immediately. For a catalogue of this size,
 * spread across four languages, that is also the cheaper build.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}

  const [seo, general] = await Promise.all([
    getSettings('site.seo', locale),
    getSettings('site.general', locale),
  ])

  const siteName = general.siteName || 'VDS'
  const title = seo.defaultTitle || siteName

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
    title: { default: title, template: seo.titleTemplate || `%s · ${siteName}` },
    description: seo.defaultDescription || undefined,
    applicationName: siteName || undefined,
    // Indexing stays off until a Super Admin turns it on for launch. Shipping
    // a staging site that indexes itself is a mistake that is hard to undo.
    robots: seo.robotsAllowIndexing
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      type: 'website',
      siteName: siteName || undefined,
      locale: LOCALE_DESCRIPTORS[locale].bcp47,
    },
  }
}

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const { enabledLocales, defaultLocale } = await getLocaleSettings()
  // A disabled language must not be reachable by typing its URL.
  if (!enabledLocales.includes(locale)) notFound()

  setRequestLocale(locale)

  const [messages, t] = await Promise.all([getMessages(), getTranslations('common')])

  const descriptor = LOCALE_DESCRIPTORS[locale as Locale]

  return (
    // `suppressHydrationWarning` covers exactly one attribute: `data-theme`,
    // which the bootstrap script writes before React ever runs. Without it
    // React sees an attribute the server did not send, warns, and — worse —
    // reverts it during hydration, so the page silently snaps back to light a
    // moment after loading.
    <html lang={descriptor.bcp47} dir={descriptor.direction} suppressHydrationWarning>
      <head>
        {/*
          Restores the visitor's saved theme before anything paints, or follows
          their operating system if they have never chosen. Inline and constant
          so the Content-Security-Policy can admit it by hash — see
          src/lib/site-theme.ts for why it cannot be rendered from the cookie on
          the server, and for what maintains the theme after hydration.
        */}
        <script
          data-theme-init=""
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body className="flex min-h-screen flex-col bg-[var(--surface-page)] antialiased">
        <NextIntlClientProvider messages={messages}>
          <a href="#main" className="skip-link">
            {t('skipToContent')}
          </a>
          <SiteHeader
            locale={locale}
            defaultLocale={defaultLocale}
            enabledLocales={enabledLocales}
          />
          <main id="main" className="flex-1 focus:outline-none" tabIndex={-1}>
            {children}
          </main>
          <SiteFooter locale={locale} defaultLocale={defaultLocale} />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
