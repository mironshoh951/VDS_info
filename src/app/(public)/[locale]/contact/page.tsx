import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Mail, Phone, MapPin, Clock, User } from 'lucide-react'
import { preparePage } from '@/server/modules/shared/page-context'
import { listOffices } from '@/server/modules/catalog/content-queries'
import { getRenderedForm } from '@/server/modules/forms/service'
import { getSettings } from '@/server/modules/settings/service'
import { getPageBySystemKey } from '@/server/modules/pages/service'
import { buildMetadata } from '@/server/modules/seo/metadata'
import { organizationSchema } from '@/server/modules/seo/structured-data'
import { PageHeader } from '@/components/site/page-header'
import { EnquiryForm } from '@/components/site/enquiry-form'
import { BlockRenderer } from '@/components/blocks/registry'
import { JsonLd } from '@/components/site/json-ld'

export const revalidate = 300

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'contact' })
  return buildMetadata({
    locale: locale as never,
    path: 'contact',
    title: t('title'),
    description: t('description'),
  })
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale, context } = await preparePage(params)

  const [offices, form, general, contactSettings, tNav, t, tCommon, page] =
    await Promise.all([
      listOffices(context),
      getRenderedForm('contact', context),
      getSettings('site.general', locale),
      getSettings('site.contact', locale),
      getTranslations('nav'),
      getTranslations('contact'),
      getTranslations('common'),
      getPageBySystemKey('contact', context),
    ])

  const formatHours = (hours: Array<{ days: number[]; open: string; close: string }>) =>
    hours.map((entry) => {
      const days = entry.days
        .map((day) => WEEKDAY_KEYS[day % 7])
        .filter(Boolean)
        .join(', ')
      return `${days}: ${entry.open}–${entry.close}`
    })

  return (
    <>
      <JsonLd data={await organizationSchema(locale)} />

      <PageHeader
        title={t('title')}
        description={t('description')}
        crumbs={[{ label: tNav('home'), href: `/${locale}` }, { label: tNav('contact') }]}
      />

      <div className="content-container py-10 md:py-14">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
          <div className="min-w-0">
            {(contactSettings.primaryEmail || contactSettings.primaryPhone) && (
              <ul className="mb-10 grid gap-4 sm:grid-cols-2">
                {contactSettings.primaryEmail && (
                  <li className="flex items-start gap-3 rounded-lg border border-[var(--border-subtle)] bg-white p-4">
                    <Mail
                      className="text-primary-600 mt-0.5 h-5 w-5 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-xs tracking-wider text-neutral-500 uppercase">
                        {t('email')}
                      </p>
                      <a
                        href={`mailto:${contactSettings.primaryEmail}`}
                        className="text-primary-700 text-sm font-medium break-all hover:underline"
                      >
                        {contactSettings.primaryEmail}
                      </a>
                    </div>
                  </li>
                )}
                {contactSettings.primaryPhone && (
                  <li className="flex items-start gap-3 rounded-lg border border-[var(--border-subtle)] bg-white p-4">
                    <Phone
                      className="text-primary-600 mt-0.5 h-5 w-5 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-xs tracking-wider text-neutral-500 uppercase">
                        {t('phone')}
                      </p>
                      <a
                        href={`tel:${contactSettings.primaryPhone.replace(/\s+/g, '')}`}
                        className="text-primary-700 text-sm font-medium hover:underline"
                      >
                        {contactSettings.primaryPhone}
                      </a>
                    </div>
                  </li>
                )}
              </ul>
            )}

            <h2 className="mb-5 text-xl font-semibold text-neutral-900">
              {t('offices')}
            </h2>

            {offices.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] px-6 py-10 text-center text-sm text-neutral-600">
                {t('noOffices')}
              </p>
            ) : (
              <ul className="space-y-5">
                {offices.map((office) => (
                  <li
                    key={office.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-white p-5"
                  >
                    <h3 className="font-semibold text-neutral-900">
                      {office.name}
                      {office.isHeadquarters && (
                        <span className="bg-primary-50 text-primary-700 ml-2 rounded-full px-2 py-0.5 text-xs font-medium">
                          HQ
                        </span>
                      )}
                    </h3>

                    <dl className="mt-3 space-y-2 text-sm text-neutral-700">
                      {(office.addressLine || office.city) && (
                        <div className="flex items-start gap-2">
                          <dt className="sr-only">{t('address')}</dt>
                          <MapPin
                            className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400"
                            aria-hidden="true"
                          />
                          <dd>
                            {[office.addressLine, office.city, office.countryCode]
                              .filter(Boolean)
                              .join(', ')}
                          </dd>
                        </div>
                      )}

                      {office.phone && (
                        <div className="flex items-start gap-2">
                          <dt className="sr-only">{t('phone')}</dt>
                          <Phone
                            className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400"
                            aria-hidden="true"
                          />
                          <dd>
                            <a
                              href={`tel:${office.phone.replace(/\s+/g, '')}`}
                              className="text-primary-700 hover:underline"
                            >
                              {office.phone}
                            </a>
                          </dd>
                        </div>
                      )}

                      {office.email && (
                        <div className="flex items-start gap-2">
                          <dt className="sr-only">{t('email')}</dt>
                          <Mail
                            className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400"
                            aria-hidden="true"
                          />
                          <dd>
                            <a
                              href={`mailto:${office.email}`}
                              className="text-primary-700 break-all hover:underline"
                            >
                              {office.email}
                            </a>
                          </dd>
                        </div>
                      )}

                      {office.workingHours.length > 0 && (
                        <div className="flex items-start gap-2">
                          <dt className="sr-only">{t('workingHours')}</dt>
                          <Clock
                            className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400"
                            aria-hidden="true"
                          />
                          <dd>
                            {formatHours(office.workingHours).map((line) => (
                              <span key={line} className="block">
                                {line}
                              </span>
                            ))}
                          </dd>
                        </div>
                      )}

                      {office.contactPerson && (
                        <div className="flex items-start gap-2">
                          <dt className="sr-only">Contact</dt>
                          <User
                            className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400"
                            aria-hidden="true"
                          />
                          <dd>{office.contactPerson}</dd>
                        </div>
                      )}
                    </dl>

                    {office.mapEmbedUrl && (
                      <div className="mt-4 overflow-hidden rounded-lg border border-[var(--border-subtle)]">
                        <iframe
                          src={office.mapEmbedUrl}
                          title={`${office.name} — map`}
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          className="h-56 w-full border-0"
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-6">
              <h2 className="text-xl font-semibold text-neutral-900">{t('formTitle')}</h2>
              <div className="mt-5">
                {form ? (
                  <EnquiryForm
                    formKey={form.key}
                    fields={form.fields}
                    locale={locale}
                    submitLabel={tCommon('contactUs')}
                  />
                ) : (
                  <p className="text-sm text-neutral-500">{tCommon('notAvailable')}</p>
                )}
              </div>
            </div>

            {general.legalName && (
              <p className="mt-4 text-xs text-neutral-500">{general.legalName}</p>
            )}
          </div>
        </div>
      </div>

      {/* Any extra CMS blocks configured on the contact page render below the
          fixed office/form layout, so an editor can add a map, an FAQ or a
          note without a code change. */}
      {page?.blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} locale={locale} />
      ))}
    </>
  )
}
