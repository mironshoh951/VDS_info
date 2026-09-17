import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { preparePage, firstParam, intParam } from '@/server/modules/shared/page-context'
import { listArticles } from '@/server/modules/catalog/directory-queries'
import { buildMetadata } from '@/server/modules/seo/metadata'
import { PageHeader } from '@/components/site/page-header'
import { Pagination } from '@/components/site/pagination'
import { ArticleCardView } from '@/components/cards/article-card'

export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const tNav = await getTranslations({ locale, namespace: 'nav' })
  return buildMetadata({ locale: locale as never, path: 'news', title: tNav('news') })
}

export default async function NewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale, context } = await preparePage(params)
  const query = await searchParams

  const categorySlug = firstParam(query, 'category')

  const [result, tNav, tNews, tCards, tPagination] = await Promise.all([
    listArticles(context, {
      page: intParam(query, 'page', 1),
      pageSize: 12,
      ...(categorySlug ? { categorySlug } : {}),
    }),
    getTranslations('nav'),
    getTranslations('news'),
    getTranslations('cards'),
    getTranslations('pagination'),
  ])

  const buildHref = (targetPage: number) => {
    const search = new URLSearchParams()
    if (categorySlug) search.set('category', categorySlug)
    if (targetPage > 1) search.set('page', String(targetPage))
    const suffix = search.toString()
    return `/${locale}/news${suffix ? `?${suffix}` : ''}`
  }

  return (
    <>
      <PageHeader
        title={tNav('news')}
        crumbs={[{ label: tNav('home'), href: `/${locale}` }, { label: tNav('news') }]}
      />

      <div className="content-container py-10 md:py-14">
        {result.items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] px-6 py-16 text-center text-sm text-neutral-600">
            {tNews('noArticles')}
          </p>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {result.items.map((article) => (
              <li key={article.id} className="flex">
                <div className="flex w-full">
                  <ArticleCardView
                    article={article}
                    locale={locale}
                    readingLabel={(minutes) => tCards('readingTime', { minutes })}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          buildHref={buildHref}
          labels={{
            previous: tPagination('previous'),
            next: tPagination('next'),
            page: tPagination('page', { page: result.page, total: result.totalPages }),
          }}
        />
      </div>
    </>
  )
}
