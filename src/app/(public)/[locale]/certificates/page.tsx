import type { Metadata } from 'next'
import Image from 'next/image'
import { getTranslations, getFormatter } from 'next-intl/server'
import { ExternalLink, ShieldCheck } from 'lucide-react'
import { preparePage } from '@/server/modules/shared/page-context'
import { listCertificates } from '@/server/modules/catalog/content-queries'
import { buildMetadata } from '@/server/modules/seo/metadata'
import { PageHeader } from '@/components/site/page-header'
import { Badge, Card, CardBody, ImagePlaceholder } from '@/components/ui'

export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'certificates' })
  return buildMetadata({
    locale: locale as never,
    path: 'certificates',
    title: t('title'),
    description: t('description'),
  })
}

export default async function CertificatesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale, context } = await preparePage(params)

  const [certificates, tNav, t, format] = await Promise.all([
    listCertificates(context),
    getTranslations('nav'),
    getTranslations('certificates'),
    getFormatter(),
  ])

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        crumbs={[
          { label: tNav('home'), href: `/${locale}` },
          { label: tNav('certificates') },
        ]}
      />

      <div className="content-container py-10 md:py-14">
        {certificates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] px-6 py-16 text-center text-sm text-neutral-600">
            {t('noCertificates')}
          </p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {certificates.map((certificate) => (
              <li key={certificate.id} className="flex">
                <Card className="w-full">
                  <div className="relative aspect-4/3 border-b border-[var(--border-subtle)] bg-white">
                    {certificate.thumbnailUrl ? (
                      <Image
                        src={certificate.thumbnailUrl}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 340px, 50vw"
                        className="object-contain p-4"
                      />
                    ) : (
                      <ImagePlaceholder
                        className="h-full w-full"
                        label={certificate.kind}
                      />
                    )}
                  </div>

                  <CardBody>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="brand" size="sm">
                        {certificate.kind}
                      </Badge>
                      {certificate.expiryState === 'expiring' && (
                        <Badge variant="warning" size="sm">
                          {t('expiringSoon')}
                        </Badge>
                      )}
                      {certificate.expiryState === 'expired' && (
                        <Badge variant="danger" size="sm">
                          {t('expired')}
                        </Badge>
                      )}
                    </div>

                    <h2 className="text-base font-semibold text-neutral-900">
                      {certificate.title}
                    </h2>

                    {certificate.description && (
                      <p className="line-clamp-3 text-sm text-neutral-600">
                        {certificate.description}
                      </p>
                    )}

                    <dl className="mt-2 space-y-1 text-xs text-neutral-500">
                      {certificate.issuer && (
                        <div className="flex gap-1.5">
                          <dt>{t('issuer')}:</dt>
                          <dd className="text-neutral-700">{certificate.issuer}</dd>
                        </div>
                      )}
                      {certificate.referenceNo && (
                        <div className="flex gap-1.5">
                          <dt>{t('reference')}:</dt>
                          <dd className="font-mono text-neutral-700">
                            {certificate.referenceNo}
                          </dd>
                        </div>
                      )}
                      {certificate.issuedOn && (
                        <div className="flex gap-1.5">
                          <dt>{t('issued')}:</dt>
                          <dd className="text-neutral-700">
                            <time dateTime={certificate.issuedOn.toISOString()}>
                              {format.dateTime(certificate.issuedOn, 'short')}
                            </time>
                          </dd>
                        </div>
                      )}
                      {certificate.expiresOn && (
                        <div className="flex gap-1.5">
                          <dt>{t('expires')}:</dt>
                          <dd className="text-neutral-700">
                            <time dateTime={certificate.expiresOn.toISOString()}>
                              {format.dateTime(certificate.expiresOn, 'short')}
                            </time>
                          </dd>
                        </div>
                      )}
                    </dl>

                    {certificate.fileUrl && (
                      <a
                        href={certificate.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-700 mt-3 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('viewDocument')}
                      </a>
                    )}
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-10 flex items-start gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-5 py-4 text-sm text-neutral-600">
          <ShieldCheck
            className="text-primary-600 mt-0.5 h-5 w-5 shrink-0"
            aria-hidden="true"
          />
          <span>{t('description')}</span>
        </p>
      </div>
    </>
  )
}
