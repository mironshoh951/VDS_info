import { db } from '../../src/server/db/client'
import { LOCALE_DESCRIPTORS, LOCALES } from '../../src/i18n/config'

/**
 * Locales and site settings.
 *
 * These are configuration, not business content: the four locales are the
 * launch requirement, and the settings below are technical defaults plus
 * clearly-marked placeholders that the company replaces before launch.
 */

export async function seedLocales(): Promise<void> {
  for (const [index, code] of LOCALES.entries()) {
    const descriptor = LOCALE_DESCRIPTORS[code]
    await db.locale.upsert({
      where: { code },
      create: {
        code,
        bcp47: descriptor.bcp47,
        nativeName: descriptor.nativeName,
        englishName: descriptor.englishName,
        direction: descriptor.direction === 'rtl' ? 'RTL' : 'LTR',
        enabled: true,
        isDefault: code === 'en',
        sortOrder: index,
        flagEmoji: descriptor.flagEmoji,
        fallbackTo: code === 'en' ? null : 'en',
      },
      update: {
        bcp47: descriptor.bcp47,
        nativeName: descriptor.nativeName,
        englishName: descriptor.englishName,
      },
    })
  }
}

interface SettingSeed {
  namespace: string
  key: string
  value: unknown
  localized?: Record<string, unknown>
  isSensitive?: boolean
}

/**
 * PLACEHOLDER VALUES.
 *
 * Contact details, addresses and any figure a visitor could read as a company
 * claim are left empty or obviously marked. The platform does not invent
 * business facts (§73, §79) — these are filled in from the admin panel.
 */
const settings: SettingSeed[] = [
  {
    namespace: 'site.general',
    key: 'siteName',
    value: 'VDS Dental Shop',
    localized: {
      en: 'VDS Dental Shop',
      ru: 'VDS Dental Shop',
      uz: 'VDS Dental Shop',
      zh: 'VDS Dental Shop',
    },
  },
  {
    namespace: 'site.general',
    key: 'tagline',
    value: 'Dental equipment and materials for clinics and laboratories.',
    localized: {
      en: 'Dental equipment and materials for clinics and laboratories.',
      ru: 'Стоматологическое оборудование и материалы для клиник и лабораторий.',
      uz: 'Klinika va laboratoriyalar uchun stomatologik uskuna va materiallar.',
      zh: '为口腔诊所与技工室提供牙科设备与材料。',
    },
  },
  { namespace: 'site.general', key: 'legalName', value: '' },
  { namespace: 'site.general', key: 'registrationNumber', value: '' },

  { namespace: 'site.i18n', key: 'defaultLocale', value: 'uz' },
  { namespace: 'site.i18n', key: 'enabledLocales', value: ['en', 'ru', 'uz', 'zh'] },
  { namespace: 'site.i18n', key: 'publishAiDrafts', value: false },

  // Deliberately blank: a placeholder phone number on a live site is worse
  // than no phone number at all.
  { namespace: 'site.contact', key: 'primaryEmail', value: '' },
  { namespace: 'site.contact', key: 'primaryPhone', value: '' },
  { namespace: 'site.contact', key: 'whatsapp', value: '' },
  { namespace: 'site.contact', key: 'telegram', value: '' },
  { namespace: 'site.contact', key: 'notificationRecipients', value: [] },

  {
    namespace: 'site.seo',
    key: 'defaultTitle',
    value: 'VDS Dental Shop',
    localized: {
      en: 'VDS Dental Shop — Dental equipment and materials',
      ru: 'VDS Dental Shop — стоматологическое оборудование и материалы',
      uz: 'VDS Dental Shop — stomatologik uskuna va materiallar',
      zh: 'VDS Dental Shop — 牙科设备与材料',
    },
  },
  {
    namespace: 'site.seo',
    key: 'titleTemplate',
    value: '%s · VDS Dental Shop',
  },
  {
    namespace: 'site.seo',
    key: 'defaultDescription',
    value: 'Supplier of dental equipment, materials and laboratory products.',
    localized: {
      en: 'Supplier of dental equipment, materials and laboratory products for clinics in Uzbekistan and international partners.',
      ru: 'Поставщик стоматологического оборудования, материалов и лабораторной продукции для клиник в Узбекистане и международных партнёров.',
      uz: "O'zbekistondagi klinikalar va xalqaro hamkorlar uchun stomatologik uskuna, material va laboratoriya mahsulotlari yetkazib beruvchi.",
      zh: '为乌兹别克斯坦诊所及国际合作伙伴提供牙科设备、材料与技工室产品。',
    },
  },
  // Indexing stays OFF until the company decides the site is ready.
  { namespace: 'site.seo', key: 'robotsAllowIndexing', value: false },

  { namespace: 'site.maintenance', key: 'enabled', value: false },
  { namespace: 'site.privacy', key: 'cookieBannerEnabled', value: true },
  { namespace: 'site.privacy', key: 'policyVersion', value: '1' },

  { namespace: 'security.policy', key: 'inquiryViewerSeesPii', value: false },
  { namespace: 'security.policy', key: 'requireMfaForSuperAdmin', value: false },

  { namespace: 'ai.routing', key: 'publicAssistantEnabled', value: false },
  { namespace: 'ai.routing', key: 'adminAssistantEnabled', value: true },
  { namespace: 'ai.budget', key: 'monthlyLimitUsd', value: 100 },
]

export async function seedSettings(): Promise<void> {
  for (const setting of settings) {
    await db.siteSetting.upsert({
      where: { namespace_key: { namespace: setting.namespace, key: setting.key } },
      create: {
        namespace: setting.namespace,
        key: setting.key,
        value: setting.value as object,
        localized: (setting.localized ?? undefined) as object | undefined,
        isSensitive: setting.isSensitive ?? false,
      },
      update: {
        value: setting.value as object,
        localized: (setting.localized ?? undefined) as object | undefined,
      },
    })
  }

  // Marks the site as carrying demonstration content, which renders a
  // dismissible notice so nobody mistakes seeded examples for real data.
  await db.siteSetting.upsert({
    where: { namespace_key: { namespace: 'site.general', key: 'demoContent' } },
    create: {
      namespace: 'site.general',
      key: 'demoContent',
      value: true,
      description:
        'Set to false once real content has replaced the development seed data.',
    },
    update: {},
  })
}

export async function seedSocialLinks(): Promise<void> {
  // Platforms the company is likely to use, seeded disabled and without URLs.
  // Visible links with fake destinations would be worse than none.
  const platforms = ['instagram', 'telegram', 'facebook', 'youtube', 'linkedin']

  for (const [index, platform] of platforms.entries()) {
    const existing = await db.socialLink.findFirst({
      where: { platform, partnerId: null, brandId: null, teamMemberId: null },
      select: { id: true },
    })
    if (existing) continue

    await db.socialLink.create({
      data: {
        platform,
        url: '',
        label: platform.charAt(0).toUpperCase() + platform.slice(1),
        sortOrder: index,
        visible: false,
      },
    })
  }
}
