import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { preparePage } from '@/server/modules/shared/page-context'
import { getPageBySlug } from '@/server/modules/pages/service'
import { getLocaleSettings } from '@/server/modules/settings/service'
import {
  buildMetadata,
  metaDescription,
  seoOverride,
} from '@/server/modules/seo/metadata'
import { breadcrumbSchema } from '@/server/modules/seo/structured-data'
import { isLocale, type Locale } from '@/i18n/config'
import { PageHeader } from '@/components/site/page-header'
import { BlockRenderer } from '@/components/blocks/registry'
import { JsonLd } from '@/components/site/json-ld'

/**
 * Catch-all for CMS pages.
 *
 * Anything that is not a built-in route — About, the legal pages, FAQ,
 * Careers, and any page a Super Admin creates later — resolves here and is
 * rendered from its blocks. Creating a new page in the admin panel therefore
 * publishes a working URL with no deployment (§31, §32).
 *
 * Built-in routes such as /products win over this one because Next.js
 * prefers a more specific segment to a catch-all.
 */
export const revalidate = 300

function pathFrom(slug: string[]): string {
  return slug.join('/')
}

async function load(params: Promise<{ locale: string; slug: string[] }>) {
  const { locale, slug } = await params
  if (!isLocale(locale)) return null

  const { defaultLocale, publishAiDrafts } = await getLocaleSettings()
  const page = await getPageBySlug(pathFrom(slug), {
    locale,
    defaultLocale,
    publishAiDrafts,
  })

  return page ? { page, locale: locale as Locale } : null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string[] }>
}): Promise<Metadata> {
  const loaded = await load(params)
  if (!loaded) return {}

  const { page, locale } = loaded
  const override = await seoOverride('PAGE', page.id, locale)

  return buildMetadata({
    locale,
    path: page.slug,
    title: override?.title ?? page.title,
    description: override?.description ?? metaDescription(page.summary),
    modifiedTime: page.updatedAt,
    ...(override?.noindex ? { noindex: true } : {}),
  })
}

export default async function CmsPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string[] }>
}) {
  const { locale } = await preparePage(params)
  const loaded = await load(params)
  if (!loaded) notFound()

  const { page } = loaded
  const tNav = await getTranslations('nav')

  const crumbs = [{ label: tNav('home'), href: `/${locale}` }, { label: page.title }]

  // A page whose first block is a hero supplies its own heading; adding the
  // standard header on top of it would give the page two competing titles.
  const firstBlockIsHero = page.blocks[0]?.type === 'hero'

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      {!firstBlockIsHero && (
        <PageHeader
          title={page.title}
          description={page.subtitle ?? page.summary}
          crumbs={crumbs}
        />
      )}

      {page.blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} locale={locale} />
      ))}
    </>
  )
}
