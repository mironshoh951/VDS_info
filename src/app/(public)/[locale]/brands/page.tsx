import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { preparePage } from '@/server/modules/shared/page-context'
import { listBrands } from '@/server/modules/catalog/directory-queries'
import { buildMetadata } from '@/server/modules/seo/metadata'
import { PageHeader } from '@/components/site/page-header'
import { Card, CardBody, CardFooter, ImagePlaceholder } from '@/components/ui'

export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const [tNav, tBrand] = await Promise.all([
    getTranslations({ locale, namespace: 'nav' }),
    getTranslations({ locale, namespace: 'brand' }),
  ])
  return buildMetadata({
    locale: locale as never,
    path: 'brands',
    title: tNav('brands'),
    description: tBrand('directory'),
  })
}

export default async function BrandsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale, context } = await preparePage(params)

  const [brands, tNav, tBrand, tCards, tFilters] = await Promise.all([
    listBrands(context),
    getTranslations('nav'),
    getTranslations('brand'),
    getTranslations('cards'),
    getTranslations('filters'),
  ])

  return (
    <>
      <PageHeader
        title={tNav('brands')}
        description={tBrand('directory')}
        crumbs={[{ label: tNav('home'), href: `/${locale}` }, { label: tNav('brands') }]}
      />

      <div className="content-container py-10 md:py-14">
        {brands.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] px-6 py-16 text-center text-sm text-neutral-600">
            {tFilters('noResults')}
          </p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {brands.map((brand) => (
              <li key={brand.id} className="flex">
                <Card interactive className="w-full">
                  <div className="flex h-28 items-center justify-center border-b border-[var(--border-subtle)] bg-white p-5">
                    {brand.logoUrl ? (
                      <span className="relative h-full w-full">
                        <Image
                          src={brand.logoUrl}
                          alt={brand.name}
                          fill
                          sizes="220px"
                          className="object-contain"
                        />
                      </span>
                    ) : (
                      <ImagePlaceholder
                        label={brand.name}
                        className="h-full w-full rounded"
                      />
                    )}
                  </div>
                  <CardBody>
                    <h2 className="text-base font-semibold text-neutral-900">
                      <Link
                        href={brand.href}
                        className="hover:text-primary-800 after:absolute after:inset-0"
                      >
                        {brand.name}
                      </Link>
                    </h2>
                    {brand.tagline && (
                      <p className="text-sm text-neutral-600">{brand.tagline}</p>
                    )}
                    {brand.shortDescription && (
                      <p className="line-clamp-2 text-sm text-neutral-500">
                        {brand.shortDescription}
                      </p>
                    )}
                  </CardBody>
                  <CardFooter>
                    <span>{tCards('products', { count: brand.productCount })}</span>
                    {brand.countryCode && (
                      <span className="ml-auto text-neutral-500">
                        {brand.countryCode}
                      </span>
                    )}
                  </CardFooter>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
