import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { preparePage, firstParam, intParam } from '@/server/modules/shared/page-context'
import { listProducts, listCategoryTree } from '@/server/modules/catalog/queries'
import { listBrands } from '@/server/modules/catalog/directory-queries'
import { PageHeader } from '@/components/site/page-header'
import { Pagination } from '@/components/site/pagination'
import { CatalogueFilters } from '@/components/site/catalogue-filters'
import { ProductCardView } from '@/components/cards/product-card'

export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'nav' })
  return { title: t('products') }
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale, context } = await preparePage(params)
  const query = await searchParams

  const page = intParam(query, 'page', 1)
  const filters = {
    query: firstParam(query, 'q'),
    categorySlug: firstParam(query, 'category'),
    brandSlug: firstParam(query, 'brand'),
    countryCode: firstParam(query, 'country'),
    sort: (firstParam(query, 'sort') ?? 'featured') as 'featured' | 'newest' | 'name',
    page,
  }

  const [result, categories, brands, tNav, tFilters, tCards, tPagination] =
    await Promise.all([
      listProducts(context, filters),
      listCategoryTree(context),
      listBrands(context),
      getTranslations('nav'),
      getTranslations('filters'),
      getTranslations('cards'),
      getTranslations('pagination'),
    ])

  const countries = [
    ...new Set(result.items.map((item) => item.countryOfOrigin).filter(Boolean)),
  ] as string[]

  const buildHref = (targetPage: number) => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string' && key !== 'page') search.set(key, value)
    }
    if (targetPage > 1) search.set('page', String(targetPage))
    const suffix = search.toString()
    return `/${locale}/products${suffix ? `?${suffix}` : ''}`
  }

  return (
    <>
      <PageHeader
        title={tNav('products')}
        crumbs={[
          { label: tNav('home'), href: `/${locale}` },
          { label: tNav('products') },
        ]}
      />

      <div className="content-container py-10 md:py-14">
        <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
          <CatalogueFilters
            basePath={`/${locale}/products`}
            current={query}
            categories={categories.map((category) => ({
              value: category.slug,
              label: category.name,
              children: category.children.map((child) => ({
                value: child.slug,
                label: child.name,
              })),
            }))}
            brands={brands.map((brand) => ({ value: brand.slug, label: brand.name }))}
            countries={countries.map((code) => ({ value: code, label: code }))}
            labels={{
              title: tFilters('title'),
              search: tFilters('search'),
              category: tFilters('category'),
              brand: tFilters('brand'),
              country: tFilters('country'),
              apply: tFilters('apply'),
              clear: tFilters('clear'),
              allCategories: tFilters('allCategories'),
              allBrands: tFilters('allBrands'),
              allCountries: tFilters('allCountries'),
            }}
          />

          <div>
            <div className="mb-6 flex items-center justify-between gap-4">
              <p className="text-sm text-neutral-600" aria-live="polite">
                {tFilters('results', { count: result.total })}
              </p>
            </div>

            {result.items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] px-6 py-16 text-center text-sm text-neutral-600">
                {tFilters('noResults')}
              </p>
            ) : (
              <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {result.items.map((product) => (
                  <li key={product.id} className="flex">
                    <div className="flex w-full">
                      <ProductCardView
                        product={product}
                        labels={{ new: tCards('new'), sku: tCards('sku') }}
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
