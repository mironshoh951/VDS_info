import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { Search as SearchIcon } from 'lucide-react'
import { preparePage, firstParam } from '@/server/modules/shared/page-context'
import { search, logSearch } from '@/server/modules/search/service'
import { buildMetadata } from '@/server/modules/seo/metadata'
import { PageHeader } from '@/components/site/page-header'
import { Badge, ImagePlaceholder } from '@/components/ui'

/**
 * Global search results.
 *
 * Always rendered dynamically: caching a search result page by URL would fill
 * the cache with one entry per query for no benefit.
 */
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'search' })
  return buildMetadata({
    locale: locale as never,
    path: 'search',
    title: t('title'),
    // Search result pages should never be indexed — they are infinite and
    // duplicate the pages they point at.
    noindex: true,
  })
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale, context } = await preparePage(params)
  const query = firstParam(await searchParams, 'q') ?? ''

  const [t, tNav] = await Promise.all([getTranslations('search'), getTranslations('nav')])

  const outcome = query ? await search(query, context) : null

  if (outcome) {
    // Fire-and-forget: logging must never delay the response.
    void logSearch({ query, locale, resultCount: outcome.total })
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        crumbs={[{ label: tNav('home'), href: `/${locale}` }, { label: t('title') }]}
      />

      <div className="content-container py-10 md:py-14">
        <form action={`/${locale}/search`} method="get" role="search" className="mb-10">
          <label htmlFor="site-search" className="sr-only">
            {t('title')}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <SearchIcon
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-400"
                aria-hidden="true"
              />
              <input
                id="site-search"
                type="search"
                name="q"
                defaultValue={query}
                placeholder={t('placeholder')}
                autoFocus={!query}
                className="h-12 w-full rounded-md border border-neutral-300 pr-3 pl-10 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              />
            </div>
            <button
              type="submit"
              className="bg-primary-700 hover:bg-primary-800 h-12 shrink-0 rounded-md px-6 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              {t('submit')}
            </button>
          </div>
        </form>

        {!outcome ? (
          <p className="text-sm text-neutral-600">{t('emptyState')}</p>
        ) : outcome.total === 0 ? (
          <p
            className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] px-6 py-16 text-center text-sm text-neutral-600"
            aria-live="polite"
          >
            {t('noResults', { query: outcome.query })}
          </p>
        ) : (
          <>
            <p className="mb-8 text-sm text-neutral-600" aria-live="polite">
              {t('resultsFor', { query: outcome.query })} ·{' '}
              {t('count', { count: outcome.total })}
            </p>

            <div className="space-y-12">
              {outcome.groups.map((group) => (
                <section key={group.type} aria-labelledby={`group-${group.type}`}>
                  <h2
                    id={`group-${group.type}`}
                    className="mb-4 text-sm font-semibold tracking-wider text-neutral-500 uppercase"
                  >
                    {t(group.labelKey)}
                  </h2>

                  <ul className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
                    {group.hits.map((hit) => (
                      <li key={hit.id}>
                        <Link
                          href={hit.href}
                          className="flex items-center gap-4 py-4 transition-colors hover:bg-[var(--surface-subtle)]"
                        >
                          {hit.imageUrl ? (
                            <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-[var(--border-subtle)] bg-white">
                              <Image
                                src={hit.imageUrl}
                                alt=""
                                fill
                                sizes="56px"
                                className="object-contain p-1"
                              />
                            </span>
                          ) : (
                            <ImagePlaceholder
                              className="h-14 w-14 shrink-0 rounded-md"
                              label=""
                            />
                          )}

                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-neutral-900">
                                {hit.title}
                              </span>
                              {hit.badge && (
                                <Badge size="sm" variant="outline">
                                  {hit.badge}
                                </Badge>
                              )}
                            </span>
                            {hit.description && (
                              <span className="mt-0.5 line-clamp-1 block text-sm text-neutral-600">
                                {hit.description}
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
