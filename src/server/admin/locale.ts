import { cookies } from 'next/headers'
import { isLocale, type Locale } from '@/i18n/config'

/**
 * Interface language for the administration panel.
 *
 * The public site carries its locale in the URL, because a page in Russian and
 * the same page in Uzbek are different documents that must be linkable and
 * indexable separately. The admin panel is the opposite: it is one private
 * workspace whose chrome happens to be readable in four languages, and an
 * editor switching language should stay exactly where they are. So the choice
 * lives in a cookie rather than the path, and no admin URL changes.
 */

export const ADMIN_LOCALE_COOKIE = 'vds_admin_locale'

/**
 * The people running this site work in Uzbek, so that is what the panel opens
 * in. This is deliberately not `DEFAULT_LOCALE`: that constant is the *source*
 * language for content — the one translations are measured against — and the
 * two answer different questions.
 */
export const ADMIN_DEFAULT_LOCALE: Locale = 'uz'

/** A year: this is a preference, not a session. */
export const ADMIN_LOCALE_MAX_AGE = 60 * 60 * 24 * 365

/**
 * Shape of a message catalogue. Declared structurally rather than as the
 * global `IntlMessages`, which this project never augments — it is next-intl's
 * empty default, so binding to it erases every key instead of checking one.
 */
export type MessageTree = { [key: string]: string | MessageTree }

/** The handful of shell strings the server-rendered layout renders itself. */
export interface AdminShellStrings {
  navigation: string
  viewSite: string
  signOut: string
  account: string
  skipToContent: string
}

const SHELL_FALLBACK: AdminShellStrings = {
  navigation: 'Administration',
  viewSite: 'View site',
  signOut: 'Sign out',
  account: 'Account',
  skipToContent: 'Skip to content',
}

export async function getAdminLocale(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(ADMIN_LOCALE_COOKIE)?.value
  return value && isLocale(value) ? value : ADMIN_DEFAULT_LOCALE
}

async function loadMessages(locale: Locale): Promise<MessageTree> {
  const mod = (await import(`../../../messages/${locale}.json`)) as {
    default: MessageTree
  }
  return mod.default
}

/**
 * What the admin shell needs in one await: the chosen locale, the full
 * catalogue to hand to `NextIntlClientProvider`, and the few strings the
 * layout itself renders.
 */
export async function getAdminIntl(): Promise<{
  locale: Locale
  messages: MessageTree
  shell: AdminShellStrings
}> {
  const locale = await getAdminLocale()
  const messages = await loadMessages(locale)

  const admin = messages.admin
  const shell =
    typeof admin === 'object' && admin !== null && typeof admin.shell === 'object'
      ? (admin.shell as unknown as AdminShellStrings)
      : SHELL_FALLBACK

  return { locale, messages, shell }
}
