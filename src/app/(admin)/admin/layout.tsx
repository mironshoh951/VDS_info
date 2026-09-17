import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getAdminIntl } from '@/server/admin/locale'
import { getAdminTheme } from '@/server/admin/theme'
import '@/styles/globals.css'

/**
 * Root layout for the administration application.
 *
 * A separate root layout from the public site, in its own route group: the two
 * surfaces share tokens and primitives but no shell, no providers and no
 * client bundle.
 *
 * Both the language and the theme are resolved here, before anything renders,
 * because both belong on `<html>`: `lang` so screen readers and hyphenation
 * are right from the first element, and `data-theme` so the browser paints the
 * correct palette on the first frame instead of flashing the wrong one.
 *
 * The admin is never indexed and never cached.
 */
export const metadata: Metadata = {
  title: { default: 'Administration', template: '%s · Administration' },
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The admin interface uses the operator's own language preference rather than
  // a URL segment, so admin URLs stay stable across languages.
  const [{ locale, messages }, theme] = await Promise.all([
    getAdminIntl(),
    getAdminTheme(),
  ])

  return (
    <html lang={locale} data-theme={theme}>
      <body className="min-h-screen bg-[var(--surface-subtle)] antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
