import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { preparePage, firstParam, intParam } from '@/server/modules/shared/page-context'
import { listPartners } from '@/server/modules/catalog/directory-queries'
import { buildMetadata } from '@/server/modules/seo/metadata'
import { PageHeader } from '@/components/site/page-header'
import { Pagination } from '@/components/site/pagination'
import { PartnerCardView } from '@/components/cards/partner-card'
import { DirectoryFilters } from '@/components/site/directory-filters'
import type { PartnershipType } from '@/server/db/generated/enums'

export const revalidate = 300

const PARTNERSHIP_TYPES: PartnershipType[] = [
  'MANUFACTURER',
  'DISTRIBUTOR',
  'TECHNOLOGY',
  'STRATEGIC',
  'EDUCATION',
  'SERVICE',
  'LOGISTICS',
  'OTHER',
]

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const [tNav, tPartner] = await Promise.all([
    getTranslations({ locale, namespace: 'nav' }),
    getTranslations({ locale, namespace: 'partner' }),
  ])
  return buildMetadata({
    locale: locale as never,
    path: 'partners',
    title: tNav('partners'),
    description: tPartner('directory'),
  })
}

export default async function PartnersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale, context } = await preparePage(params)
  const query = await searchParams

  const rawType = firstParam(query, 'type')
  const type = PARTNERSHIP_TYPES.find((value) => value === rawType)

  const result = await listPartners(context, {
    query: firstParam(query, 'q'),
    countryCode: firstParam(query, 'country'),
    ...(type ? { partnershipType: type } : {}),
    verifiedOnly: firstParam(query, 'verified') === '1',
    sort: (firstParam(query, 'sort') ?? 'featured') as 'featured' | 'alphabetical',
    page: intParam(query, 'page', 1),
  })

  const [tNav, tPartner, tFilters, tCards, tPagination] = await Promise.all([
    getTranslations('nav'),
    getTranslations('partner'),
    getTranslations('filters'),
    getTranslations('cards'),
    getTranslations('pagination'),
  ])

  const countries = [
    ...new Set(result.items.map((item) => item.countryCode).filter(Boolean)),
  ] as string[]

  const buildHref = (targetPage: number) => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string' && key !== 'page') search.set(key, value)
    }
    if (targetPage > 1) search.set('page', String(targetPage))
    const suffix = search.toString()
    return `/${locale}/partners${suffix ? `?${suffix}` : ''}`
  }

  return (
    <>
      <PageHeader
        title={tNav('partners')}
        description={tPartner('directory')}
        crumbs={[
          { label: tNav('home'), href: `/${locale}` },
          { label: tNav('partners') },
        ]}
      />

      <div className="content-container py-10 md:py-14">
        <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
          <DirectoryFilters
            basePath={`/${locale}/partners`}
            current={query}
            groups={[
              {
                key: 'type',
                label: tFilters('type'),
                allLabel: tFilters('allTypes'),
                options: PARTNERSHIP_TYPES.map((value) => ({
                  value,
                  label: tPartner(`types.${value}`),
                })),
              },
              {
                key: 'country',
                label: tFilters('country'),
                allLabel: tFilters('allCountries'),
                options: countries.map((code) => ({ value: code, label: code })),
              },
            ]}
            toggles={[{ key: 'verified', label: tFilters('verified') }]}
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
                {tFilters('noResults')}
              </p>
            ) : (
              <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {result.items.map((partner) => (
                  <li key={partner.id} className="flex">
                    <div className="flex w-full">
                      <PartnerCardView
                        partner={partner}
                        labels={{
                          verified: tCards('verified'),
                          products: tCards('products'),
                          brands: tCards('brands'),
                          partnershipType: tPartner(`types.${partner.partnershipType}`),
                        }}
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
