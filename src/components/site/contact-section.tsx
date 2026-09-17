import { getTranslations } from 'next-intl/server'
import { db } from '@/server/db/client'
import { getLocaleSettings, getSettings } from '@/server/modules/settings/service'
import { getRenderedForm } from '@/server/modules/forms/service'
import { pickTranslation } from '@/server/modules/shared/localize'
import { Section } from '@/components/ui'
import { EnquiryForm } from './enquiry-form'
import type { Locale } from '@/i18n/config'

/**
 * Contact section: the enquiry form beside the company's office details.
 *
 * Office rows with no address render only what they actually have. A contact
 * page that invents a street address is worse than one that shows a city and
 * an email — so nothing here fills gaps.
 */
export async function ContactSection({
  locale,
  formKey,
  heading,
  officesHeading,
  anchor,
  related,
}: {
  locale: Locale
  formKey: string
  heading?: string
  officesHeading?: string
  anchor?: string | null
  related?: { productId?: string; partnerId?: string; serviceId?: string }
}) {
  const { defaultLocale, publishAiDrafts } = await getLocaleSettings()
  const context = { locale, defaultLocale, publishAiDrafts }

  const [form, contact, offices, t] = await Promise.all([
    getRenderedForm(formKey, context),
    getSettings('site.contact', locale),
    db.office.findMany({
      where: { visible: true, deletedAt: null },
      orderBy: [{ isHeadquarters: 'desc' }, { sortOrder: 'asc' }],
      select: {
        id: true,
        city: true,
        countryCode: true,
        phone: true,
        email: true,
        workingHours: true,
        translations: {
          where: { locale: { in: [locale, defaultLocale] } },
          select: { locale: true, name: true, addressLine: true, cityLocalized: true },
        },
      },
    }),
    getTranslations('common'),
  ])

  return (
    <Section id={anchor ?? 'contact'} tone="subtle">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          {heading && (
            <h2 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
              {heading}
            </h2>
          )}

          {form ? (
            <EnquiryForm
              formKey={form.key}
              fields={form.fields}
              locale={locale}
              related={related}
              submitLabel={t('requestInformation')}
            />
          ) : (
            <p className="text-sm text-neutral-500">
              No enquiry form has been configured yet.
            </p>
          )}
        </div>

        <aside className="space-y-8">
          {(contact.primaryEmail || contact.primaryPhone) && (
            <div className="space-y-2 text-sm">
              {contact.primaryEmail && (
                <p>
                  <a
                    className="text-primary-800 font-medium hover:underline"
                    href={`mailto:${contact.primaryEmail}`}
                  >
                    {contact.primaryEmail}
                  </a>
                </p>
              )}
              {contact.primaryPhone && (
                <p>
                  <a
                    className="text-primary-800 font-medium hover:underline"
                    href={`tel:${contact.primaryPhone.replace(/\s+/g, '')}`}
                  >
                    {contact.primaryPhone}
                  </a>
                </p>
              )}
            </div>
          )}

          {offices.length > 0 && (
            <div>
              {officesHeading && (
                <h3 className="mb-4 text-sm font-semibold tracking-wider text-neutral-500 uppercase">
                  {officesHeading}
                </h3>
              )}
              <ul className="space-y-5">
                {offices.map((office) => {
                  const picked = pickTranslation(office.translations, context)
                  const hours = Array.isArray(office.workingHours)
                    ? (office.workingHours as Array<{
                        days: number[]
                        open: string
                        close: string
                      }>)
                    : []

                  return (
                    <li key={office.id} className="text-sm leading-relaxed">
                      <p className="font-medium text-neutral-900">
                        {picked?.translation.name ?? office.city}
                      </p>
                      <p className="text-neutral-600">
                        {picked?.translation.cityLocalized ?? office.city}
                        {office.countryCode ? `, ${office.countryCode}` : ''}
                      </p>
                      {picked?.translation.addressLine ? (
                        <p className="text-neutral-600">
                          {picked.translation.addressLine}
                        </p>
                      ) : null}
                      {office.phone && <p className="text-neutral-600">{office.phone}</p>}
                      {office.email && <p className="text-neutral-600">{office.email}</p>}
                      {hours.length > 0 && (
                        <p className="mt-1 text-neutral-500">
                          {hours
                            .map((entry) => `${entry.open}–${entry.close}`)
                            .join(', ')}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </Section>
  )
}
