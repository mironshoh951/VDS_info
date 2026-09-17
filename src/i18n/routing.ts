import { defineRouting } from 'next-intl/routing'
import { LOCALES, DEFAULT_LOCALE } from './config'

/**
 * Locale routing.
 *
 * `localePrefix: 'always'` keeps the locale segment on every URL, including
 * the default language. That costs one redirect at the root but buys
 * unambiguous canonical URLs and honest hreflang — worth it for a site whose
 * SEO has to work in four languages (§38, §39).
 *
 * This module is imported by edge middleware, so it must stay free of any
 * dependency on the database, Redis or Node built-ins. Navigation helpers live
 * in `navigation.ts` for exactly that reason.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  localeCookie: {
    name: 'vds.locale',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  },
  // We emit hreflang ourselves in the document head, with the correct
  // per-locale slugs, which the middleware's header cannot know about.
  alternateLinks: false,
})
