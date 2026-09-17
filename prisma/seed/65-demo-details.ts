import { db } from '../../src/server/db/client'
import { LOCALES } from '../../src/i18n/config'

/**
 * The details the rest of the seed deliberately leaves blank.
 *
 * The other modules refuse to invent a phone number or a street address,
 * and that is the right default: a placeholder on a live supplier's contact
 * page is worse than an empty field, because a visitor will try to use it.
 *
 * But a site with every contact block empty cannot be reviewed either — you
 * cannot tell whether the contact page works when there is nothing on it. So
 * this step fills them in, and it is safe for one specific reason: the values
 * are drawn from ranges reserved for documentation and fiction, and the demo
 * banner stays up until a Super Admin turns it off. Nobody will reach a real
 * person by dialling one of these numbers.
 *
 * Every write is skipped when a value is already set, so this never overwrites
 * anything real that has been entered since.
 */

/**
 * Numbers in +998 00 000-00-xx are not allocated to any operator, so they
 * cannot connect to anyone. Same intent as 555-0100 in North America.
 */
const DEMO_PHONE = '+998 00 000-00-01'
/** example.com is reserved by the IETF precisely for this. */
const DEMO_EMAIL = 'info@example.com'

async function setSettingIfBlank(
  namespace: string,
  key: string,
  value: unknown,
  localized?: Record<string, unknown>,
): Promise<void> {
  const existing = await db.siteSetting.findUnique({
    where: { namespace_key: { namespace, key } },
    select: { value: true },
  })

  const current = existing?.value
  const isBlank =
    current === null ||
    current === undefined ||
    current === '' ||
    (Array.isArray(current) && current.length === 0)
  if (!isBlank) return

  await db.siteSetting.upsert({
    where: { namespace_key: { namespace, key } },
    create: {
      namespace,
      key,
      value: value as object,
      localized: (localized ?? undefined) as object | undefined,
    },
    update: {
      value: value as object,
      localized: (localized ?? undefined) as object | undefined,
    },
  })
}

export async function seedDemoDetails(): Promise<void> {
  // --- Contact details --------------------------------------------------------
  await setSettingIfBlank('site.contact', 'primaryEmail', DEMO_EMAIL)
  await setSettingIfBlank('site.contact', 'primaryPhone', DEMO_PHONE)
  await setSettingIfBlank('site.contact', 'whatsapp', DEMO_PHONE)
  await setSettingIfBlank('site.contact', 'telegram', '@example')
  await setSettingIfBlank('site.general', 'legalName', 'VDS Dental Shop LLC (demo)')

  // --- Offices ----------------------------------------------------------------
  const offices = await db.office.findMany({
    where: { deletedAt: null },
    select: { id: true, key: true, phone: true, email: true, latitude: true },
  })

  // Coordinates are the real city centres, so the map is not in the sea. The
  // street address that goes with them is fictional and says so.
  const places: Record<
    string,
    { lat: number; lon: number; street: Record<string, string> }
  > = {
    'head-office': {
      lat: 41.3111,
      lon: 69.2797,
      street: {
        en: '1 Example Street, Yunusabad (demo address)',
        ru: 'ул. Примерная, 1, Юнусабад (демо-адрес)',
        uz: "Namuna ko'chasi 1, Yunusobod (namunaviy manzil)",
        zh: '示例街 1 号，尤努斯阿巴德（演示地址）',
      },
    },
  }

  for (const office of offices) {
    const place = places[office.key]
    const data: Record<string, unknown> = {}
    if (!office.phone) data.phone = DEMO_PHONE
    if (!office.email) data.email = DEMO_EMAIL
    if (office.latitude === null && place) {
      data.latitude = place.lat
      data.longitude = place.lon
    }
    if (Object.keys(data).length > 0) {
      await db.office.update({ where: { id: office.id }, data })
    }

    if (!place) continue
    for (const locale of LOCALES) {
      const translation = await db.officeTranslation.findFirst({
        where: { officeId: office.id, locale },
        select: { id: true, addressLine: true },
      })
      if (!translation || translation.addressLine) continue
      await db.officeTranslation.update({
        where: { id: translation.id },
        data: { addressLine: place.street[locale] ?? place.street.en ?? '' },
      })
    }
  }

  // --- The statistics block ---------------------------------------------------
  // Left empty by the structure seed because "500+ partners" is a business
  // claim. It stays a claim here, which is why every figure is written as a
  // round demo number and the banner above it says the content is fictional.
  const blocks = await db.pageBlock.findMany({
    where: { type: 'statistics' },
    select: {
      id: true,
      translations: { select: { id: true, locale: true, props: true } },
    },
  })

  const figures: Record<string, { value: string; label: string }[]> = {
    en: [
      { value: '15', label: 'Years in the market' },
      { value: '40+', label: 'Brands represented' },
      { value: '900+', label: 'Clinics supplied' },
      { value: '48h', label: 'Typical delivery' },
    ],
    ru: [
      { value: '15', label: 'Лет на рынке' },
      { value: '40+', label: 'Представленных брендов' },
      { value: '900+', label: 'Обслуженных клиник' },
      { value: '48 ч', label: 'Обычная доставка' },
    ],
    uz: [
      { value: '15', label: 'Yillik tajriba' },
      { value: '40+', label: 'Taqdim etilgan brend' },
      { value: '900+', label: "Ta'minlangan klinika" },
      { value: '48 soat', label: 'Odatdagi yetkazib berish' },
    ],
    zh: [
      { value: '15', label: '年行业经验' },
      { value: '40+', label: '代理品牌' },
      { value: '900+', label: '服务诊所' },
      { value: '48 小时', label: '常规配送' },
    ],
  }

  for (const block of blocks) {
    for (const translation of block.translations) {
      const props = (translation.props ?? {}) as Record<string, unknown>
      const items = props.items
      if (Array.isArray(items) && items.length > 0) continue
      await db.pageBlockTranslation.update({
        where: { id: translation.id },
        data: {
          props: {
            ...props,
            items: figures[translation.locale] ?? figures.en ?? [],
          } as object,
        },
      })
    }
  }
}
