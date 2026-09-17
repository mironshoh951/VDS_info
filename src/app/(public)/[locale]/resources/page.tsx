import type { Metadata } from 'next'
import { getTranslations, getFormatter } from 'next-intl/server'
import { Download, FileText, ExternalLink } from 'lucide-react'
import { preparePage, firstParam, intParam } from '@/server/modules/shared/page-context'
import {
  listResources,
  listResourceTypes,
} from '@/server/modules/catalog/content-queries'
import { buildMetadata } from '@/server/modules/seo/metadata'
import { LOCALE_DESCRIPTORS, isLocale } from '@/i18n/config'
import { PageHeader } from '@/components/site/page-header'
import { Pagination } from '@/components/site/pagination'
import { DirectoryFilters } from '@/components/site/directory-filters'
import { Badge } from '@/components/ui'
import type { ResourceType } from '@/server/db/generated/enums'

export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'resources' })
  return buildMetadata({
    locale: locale as never,
    path: 'resources',
    title: t('title'),
    description: t('description'),
  })
}

/** Bytes to a short human string. Kept locale-neutral on purpose. */
function formatBytes(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}

export default async function ResourcesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale, context } = await preparePage(params)
  const query = await searchParams

  const availableTypes = await listResourceTypes()
  const rawType = firstParam(query, 'type')
  const type = availableTypes.find((value) => value === rawType)

  const [result, tNav, tResources, tFilters, tPagination, format] = await Promise.all([
    listResources(context, {
      query: firstParam(query, 'q'),
      ...(type ? { type: type as ResourceType } : {}),
      contentLocale: firstParam(query, 'lang'),
      page: intParam(query, 'page', 1),
    }),
    getTranslations('nav'),
    getTranslations('resources'),
    getTranslations('filters'),
    getTranslations('pagination'),
    getFormatter(),
  ])

  const buildHref = (targetPage: number) => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string' && key !== 'page') search.set(key, value)
    }
    if (targetPage > 1) search.set('page', String(targetPage))
    const suffix = search.toString()
    return `/${locale}/resources${suffix ? `?${suffix}` : ''}`
  }

  return (
    <>
      <PageHeader
        title={tResources('title')}
        description={tResources('description')}
        crumbs={[
          { label: tNav('home'), href: `/${locale}` },
          { label: tNav('resources') },
        ]}
      />

      <div className="content-container py-10 md:py-14">
        <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
          <DirectoryFilters
            basePath={`/${locale}/resources`}
            current={query}
            groups={[
              {
                key: 'type',
                label: tResources('type'),
                allLabel: tResources('allTypes'),
                options: availableTypes.map((value) => ({ value, label: value })),
              },
              {
                key: 'lang',
                label: tResources('language'),
                allLabel: tResources('allLanguages'),
                options: Object.values(LOCALE_DESCRIPTORS).map((descriptor) => ({
                  value: descriptor.code,
                  label: descriptor.nativeName,
                })),
              },
            ]}
            labels={{
              title: tFilters('title'),
              search: tFilters('search'),
              apply: tFilters('apply'),
              clear: tFilters('clear'),
            }}
          />

          <div>
            <p className="mb-6 text-sm text-neutral-600" aria-live="polite">
              {tFilters('results', { count: result.total })}
            </p>

            {result.items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] px-6 py-16 text-center text-sm text-neutral-600">
                {tResources('noResources')}
              </p>
            ) : (
              <ul className="space-y-3">
                {result.items.map((resource) => {
                  const href = resource.fileUrl ?? resource.externalUrl
                  const size = formatBytes(resource.sizeBytes)
                  const languageName =
                    resource.contentLocale && isLocale(resource.contentLocale)
                      ? LOCALE_DESCRIPTORS[resource.contentLocale].nativeName
                      : null

                  return (
                    <li
                      key={resource.id}
                      className="flex flex-col gap-4 rounded-xl border border-[var(--border-subtle)] bg-white p-5 sm:flex-row sm:items-center"
                    >
                      <FileText
                        className="text-primary-600 h-8 w-8 shrink-0"
                        aria-hidden="true"
                      />

                      <div className="min-w-0 flex-1">
                        <h2 className="font-medium text-neutral-900">{resource.title}</h2>
                        {resource.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-neutral-600">
                            {resource.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                          <Badge size="sm" variant="neutral">
                            {resource.type}
                          </Badge>
                          {languageName && <span>{languageName}</span>}
                          {size && <span>{size}</span>}
                          <time dateTime={resource.updatedAt.toISOString()}>
                            {format.dateTime(resource.updatedAt, 'short')}
                          </time>
                        </div>
                      </div>

                      {href ? (
                        <a
                          href={href}
                          {...(resource.fileUrl
                            ? { download: true }
                            : { target: '_blank', rel: 'noopener noreferrer' })}
                          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                        >
                          {resource.fileUrl ? (
                            <Download className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          )}
                          {tResources('download')}
                        </a>
                      ) : (
                        <span className="shrink-0 text-sm text-neutral-400">
                          {tResources('fileUnavailable')}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              buildHref={buildHref}
              labels={{
                previous: tPagination('previous'),
                next: tPagination('next'),
                page: tPagination('page', {
                  page: result.page,
                  total: result.totalPages,
                }),
              }}
            />
          </div>
        </div>
      </div>
    </>
  )
}
