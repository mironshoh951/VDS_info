import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { isLocale } from '@/i18n/config'
import { getLocaleSettings } from '@/server/modules/settings/service'
import { getPageBySystemKey } from '@/server/modules/pages/service'
import { BlockRenderer } from '@/components/blocks/registry'
import { NotConfiguredNotice } from '@/components/site/not-configured-notice'

/**
 * Home page.
 *
 * Entirely CMS-driven: the page row with `systemKey = "home"` supplies the
 * ordered block list, and each block supplies its own content. Nothing on this
 * page is written in code, which is the point (§8, §79).
 */

// Content changes must appear without a rebuild; publishing revalidates the
// cached render by tag, so this is cheap in practice.
export const revalidate = 300

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const { defaultLocale, publishAiDrafts } = await getLocaleSettings()
  const page = await getPageBySystemKey('home', {
    locale,
    defaultLocale,
    publishAiDrafts,
  })

  // No home page configured yet. This is a content state, not an error — the
  // notice explains it plainly instead of showing invented placeholder copy.
  if (!page || page.blocks.length === 0) {
    return <NotConfiguredNotice area="home" />
  }

  return (
    <>
      {page.blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} locale={locale} />
      ))}
    </>
  )
}
