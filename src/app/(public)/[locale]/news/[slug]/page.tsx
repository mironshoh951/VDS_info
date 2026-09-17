import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { getTranslations, getFormatter } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { preparePage } from '@/server/modules/shared/page-context'
import {
  getArticleBySlug,
  listArticles,
} from '@/server/modules/catalog/directory-queries'
import {
  buildMetadata,
  metaDescription,
  seoOverride,
} from '@/server/modules/seo/metadata'
import { breadcrumbSchema, articleSchema } from '@/server/modules/seo/structured-data'
import { getLocaleSettings, getSettings } from '@/server/modules/settings/service'
import { isLocale, type Locale } from '@/i18n/config'
import { PageHeader } from '@/components/site/page-header'
import { RichText } from '@/components/rich-text/rich-text'
import { JsonLd } from '@/components/site/json-ld'
import { ArticleCardView } from '@/components/cards/article-card'
import { Badge, Section, SectionHeader } from '@/components/ui'

export const revalidate = 300

async function load(params: Promise<{ locale: string; slug: string }>) {
  const { locale, slug } = await params
  if (!isLocale(locale)) return null
  const { defaultLocale, publishAiDrafts } = await getLocaleSettings()
  const context = { locale, defaultLocale, publishAiDrafts }
  const article = await getArticleBySlug(slug, context)
  return article ? { article, locale: locale as Locale, context } : null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const loaded = await load(params)
  if (!loaded) return {}
  const { article, locale } = loaded
  const override = await seoOverride('ARTICLE', article.id, locale)

  return buildMetadata({
    locale,
    path: `news/${article.slug}`,
    title: override?.title ?? article.title,
    description: override?.description ?? metaDescription(article.excerpt),
    imageUrl: article.coverUrl,
    type: 'article',
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    ...(override?.noindex ? { noindex: true } : {}),
  })
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, context } = await preparePage(params)
  const loaded = await load(params)
  if (!loaded) notFound()

  const { article } = loaded

  const [tNav, tNews, tCards, format, general, more] = await Promise.all([
    getTranslations('nav'),
    getTranslations('news'),
    getTranslations('cards'),
    getFormatter(),
    getSettings('site.general', locale),
    listArticles(context, { pageSize: 4 }),
  ])

  const crumbs = [
    { label: tNav('home'), href: `/${locale}` },
    { label: tNav('news'), href: `/${locale}/news` },
    { label: article.title },
  ]

  const related = more.items.filter((item) => item.id !== article.id).slice(0, 3)

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <JsonLd
        data={articleSchema({
          title: article.title,
          description: article.excerpt,
          imageUrl: article.coverUrl,
          url: `/${locale}/news/${article.slug}`,
          publishedAt: article.publishedAt,
          modifiedAt: article.updatedAt,
          authorName: article.authorName,
          publisherName: general.siteName || null,
        })}
      />

      <PageHeader
        eyebrow={article.categoryName}
        title={article.title}
        description={article.excerpt}
        crumbs={crumbs}
      />

      <article className="content-container py-10 md:py-14">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-neutral-500">
            {article.publishedAt && (
              <span>
                {tNews('publishedOn')}{' '}
                <time dateTime={article.publishedAt.toISOString()}>
                  {format.dateTime(article.publishedAt, 'long')}
                </time>
              </span>
            )}
            {article.authorName && (
              <span>
                {tNews('author')}: {article.authorName}
              </span>
            )}
            {article.readingMinutes && (
              <span>{tCards('readingTime', { minutes: article.readingMinutes })}</span>
            )}
          </div>

          {article.coverUrl && (
            <div className="relative mb-10 aspect-16/9 overflow-hidden rounded-xl border border-[var(--border-subtle)]">
              <Image
                src={article.coverUrl}
                alt=""
                fill
                sizes="(min-width: 1024px) 768px, 100vw"
                className="object-cover"
                priority
              />
            </div>
          )}

          <RichText document={article.content} className="text-[1.0625rem]" />

          {(article.relatedProducts.length > 0 || article.relatedPartners.length > 0) && (
            <div className="mt-12 space-y-6 border-t border-[var(--border-subtle)] pt-8">
              {article.relatedProducts.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold tracking-wider text-neutral-500 uppercase">
                    {tNews('relatedProducts')}
                  </h2>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {article.relatedProducts.map((product) => (
                      <li key={product.href}>
                        <Link href={product.href}>
                          <Badge variant="brand">{product.name}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {article.relatedPartners.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold tracking-wider text-neutral-500 uppercase">
                    {tNews('relatedPartners')}
                  </h2>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {article.relatedPartners.map((partner) => (
                      <li key={partner.href}>
                        <Link href={partner.href}>
                          <Badge variant="outline">{partner.name}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <Link
            href={`/${locale}/news`}
            className="text-primary-700 mt-12 inline-flex items-center gap-2 text-sm font-medium hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {tNews('backToNews')}
          </Link>
        </div>
      </article>

      {related.length > 0 && (
        <Section tone="subtle">
          <SectionHeader heading={tNews('latest')} />
          <ul className="grid gap-6 md:grid-cols-3">
            {related.map((item) => (
              <li key={item.id} className="flex">
                <div className="flex w-full">
                  <ArticleCardView
                    article={item}
                    locale={locale}
                    readingLabel={(minutes) => tCards('readingTime', { minutes })}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}
