import { db } from '../../src/server/db/client'
import { translationRows, richDoc } from './helpers'
import type { Locale } from '../../src/i18n/config'

/**
 * Partners, brands and products.
 *
 * ⚠ EVERY COMPANY, BRAND AND PRODUCT BELOW IS FICTIONAL.
 *
 * They exist so that the catalogue, the filters, the relationship model and
 * the detail templates can be seen working with realistic shapes of data.
 * None of them is a real manufacturer, none of these partnerships exists, and
 * no specification here describes a real product. Replace them before the site
 * goes live — `site.general.demoContent` drives the banner that says so.
 */

interface PartnerSeed {
  slug: string
  displayName: string
  partnershipType:
    | 'MANUFACTURER'
    | 'DISTRIBUTOR'
    | 'TECHNOLOGY'
    | 'STRATEGIC'
    | 'EDUCATION'
    | 'SERVICE'
    | 'LOGISTICS'
    | 'OTHER'
  countryCode: string
  city: string
  foundedYear: number
  website: string
  featured: boolean
  verified: boolean
  categorySlugs: string[]
  content: Record<
    Locale,
    { name: string; short: string; specialization: string; body: string[] }
  >
}

const partners: PartnerSeed[] = [
  {
    slug: 'norvenda-dental-systems',
    displayName: 'Norvenda Dental Systems',
    partnershipType: 'MANUFACTURER',
    countryCode: 'DE',
    city: 'Munich',
    foundedYear: 1998,
    website: 'https://example.com/norvenda',
    featured: true,
    verified: true,
    categorySlugs: ['manufacturers'],
    content: {
      en: {
        name: 'Norvenda Dental Systems',
        short: 'Fictional manufacturer of restorative materials and curing equipment.',
        specialization: 'Restorative materials, curing equipment',
        body: [
          'Norvenda Dental Systems is an example manufacturer profile used to demonstrate the partner directory. A real profile would describe the manufacturer’s history, production capability, quality standards and the product families it supplies.',
          'The directory supports documents, galleries, video, certifications and links to every brand and product associated with the partner.',
        ],
      },
      ru: {
        name: 'Norvenda Dental Systems',
        short:
          'Вымышленный производитель реставрационных материалов и оборудования для полимеризации.',
        specialization: 'Реставрационные материалы, оборудование для полимеризации',
        body: [
          'Norvenda Dental Systems — пример профиля производителя, показывающий работу каталога партнёров. Реальный профиль содержал бы историю компании, производственные возможности, стандарты качества и перечень выпускаемых продуктовых линеек.',
          'Каталог поддерживает документы, галереи, видео, сертификаты и связи со всеми брендами и продуктами партнёра.',
        ],
      },
      uz: {
        name: 'Norvenda Dental Systems',
        short:
          'Restavratsion materiallar va polimerizatsiya uskunalari ishlab chiqaruvchisining shartli profili.',
        specialization: 'Restavratsion materiallar, polimerizatsiya uskunalari',
        body: [
          "Norvenda Dental Systems — hamkorlar katalogi qanday ishlashini ko'rsatuvchi namunaviy ishlab chiqaruvchi profili. Haqiqiy profilda kompaniya tarixi, ishlab chiqarish quvvati, sifat standartlari va mahsulot liniyalari keltiriladi.",
          "Katalog hujjatlar, galereya, video, sertifikatlar va hamkorning barcha brend hamda mahsulotlari bilan bog'lanishni qo'llab-quvvatlaydi.",
        ],
      },
      zh: {
        name: 'Norvenda Dental Systems',
        short: '用于演示的虚构制造商，主营修复材料与光固化设备。',
        specialization: '修复材料、光固化设备',
        body: [
          'Norvenda Dental Systems 是用于演示合作伙伴目录的示例制造商档案。真实档案会介绍企业沿革、生产能力、质量标准以及所供应的产品系列。',
          '目录支持文档、图库、视频、资质证书，并可关联该合作伙伴的所有品牌与产品。',
        ],
      },
    },
  },
  {
    slug: 'hanwoo-dental-tech',
    displayName: 'Hanwoo Dental Tech',
    partnershipType: 'MANUFACTURER',
    countryCode: 'KR',
    city: 'Seoul',
    foundedYear: 2006,
    website: 'https://example.com/hanwoo',
    featured: true,
    verified: true,
    categorySlugs: ['manufacturers'],
    content: {
      en: {
        name: 'Hanwoo Dental Tech',
        short: 'Fictional manufacturer of endodontic instruments and sealers.',
        specialization: 'Endodontics, rotary instrumentation',
        body: [
          'An example partner used to show how a manufacturer specialising in a single discipline appears in the directory, with its brands and products linked to it.',
        ],
      },
      ru: {
        name: 'Hanwoo Dental Tech',
        short: 'Вымышленный производитель эндодонтических инструментов и силеров.',
        specialization: 'Эндодонтия, машинная обработка каналов',
        body: [
          'Пример партнёра, показывающий, как производитель, специализирующийся на одном направлении, отображается в каталоге вместе со связанными брендами и продуктами.',
        ],
      },
      uz: {
        name: 'Hanwoo Dental Tech',
        short:
          'Endodontik asboblar va silerlar ishlab chiqaruvchisining shartli profili.',
        specialization: 'Endodontiya, mashina bilan kanal ishlov berish',
        body: [
          "Bitta yo'nalishga ixtisoslashgan ishlab chiqaruvchi katalogda qanday ko'rinishini, brend va mahsulotlari bilan birga qanday bog'lanishini ko'rsatuvchi namuna.",
        ],
      },
      zh: {
        name: 'Hanwoo Dental Tech',
        short: '用于演示的虚构制造商，主营根管器械与封闭剂。',
        specialization: '牙髓治疗、机用根管预备',
        body: [
          '该示例展示专注单一学科的制造商在目录中的呈现方式，以及其品牌与产品的关联。',
        ],
      },
    },
  },
  {
    slug: 'aurelio-medical-supplies',
    displayName: 'Aurelio Medical Supplies',
    partnershipType: 'DISTRIBUTOR',
    countryCode: 'IT',
    city: 'Milan',
    foundedYear: 2011,
    website: 'https://example.com/aurelio',
    featured: false,
    verified: true,
    categorySlugs: ['equipment-suppliers'],
    content: {
      en: {
        name: 'Aurelio Medical Supplies',
        short:
          'Fictional distributor of impression materials and laboratory consumables.',
        specialization: 'Impression materials, laboratory consumables',
        body: [
          'A distributor profile, included to demonstrate that partnership type is a first-class field the directory can filter on.',
        ],
      },
      ru: {
        name: 'Aurelio Medical Supplies',
        short:
          'Вымышленный дистрибьютор оттискных материалов и лабораторных расходников.',
        specialization: 'Оттискные материалы, лабораторные расходные материалы',
        body: [
          'Профиль дистрибьютора, показывающий, что тип партнёрства — полноценное поле, по которому работает фильтрация каталога.',
        ],
      },
      uz: {
        name: 'Aurelio Medical Supplies',
        short:
          'Ottisk materiallari va laboratoriya sarf materiallari distribyutorining shartli profili.',
        specialization: 'Ottisk materiallari, laboratoriya sarf materiallari',
        body: [
          "Distribyutor profili — hamkorlik turi katalogda filtrlanadigan to'liq huquqli maydon ekanini ko'rsatadi.",
        ],
      },
      zh: {
        name: 'Aurelio Medical Supplies',
        short: '用于演示的虚构经销商，主营印模材料与技工室耗材。',
        specialization: '印模材料、技工室耗材',
        body: ['经销商档案示例，用以说明合作类型是目录中可筛选的独立字段。'],
      },
    },
  },
  {
    slug: 'silkway-logistics-group',
    displayName: 'Silkway Logistics Group',
    partnershipType: 'LOGISTICS',
    countryCode: 'UZ',
    city: 'Tashkent',
    foundedYear: 2015,
    website: 'https://example.com/silkway',
    featured: false,
    verified: false,
    categorySlugs: ['logistics'],
    content: {
      en: {
        name: 'Silkway Logistics Group',
        short: 'Fictional logistics partner, shown here as an unverified entry.',
        specialization: 'Customs clearance, temperature-controlled transport',
        body: [
          'This entry is deliberately left unverified so the "verified partner" badge and filter can be seen doing something.',
        ],
      },
      ru: {
        name: 'Silkway Logistics Group',
        short: 'Вымышленный логистический партнёр, показан как неподтверждённая запись.',
        specialization: 'Таможенное оформление, перевозки с температурным контролем',
        body: [
          'Запись намеренно оставлена неподтверждённой, чтобы были видны значок и фильтр «проверенный партнёр».',
        ],
      },
      uz: {
        name: 'Silkway Logistics Group',
        short: "Shartli logistika hamkori — tasdiqlanmagan yozuv sifatida ko'rsatilgan.",
        specialization: 'Bojxona rasmiylashtiruvi, harorat nazoratli tashish',
        body: [
          "Bu yozuv ataylab tasdiqlanmagan qoldirildi — «tasdiqlangan hamkor» belgisi va filtri ishlashini ko'rish uchun.",
        ],
      },
      zh: {
        name: 'Silkway Logistics Group',
        short: '用于演示的虚构物流伙伴，此处作为未认证条目展示。',
        specialization: '清关、温控运输',
        body: ['该条目刻意保持未认证状态，以便演示"认证合作伙伴"标识与筛选功能。'],
      },
    },
  },
]

export async function seedPartners(): Promise<Map<string, string>> {
  const ids = new Map<string, string>()

  for (const [index, seed] of partners.entries()) {
    const existing = await db.partner.findUnique({
      where: { slug: seed.slug },
      select: { id: true },
    })

    if (existing) {
      ids.set(seed.slug, existing.id)
      continue
    }

    const categories = await db.partnerCategory.findMany({
      where: { slug: { in: seed.categorySlugs } },
      select: { id: true },
    })

    const partner = await db.partner.create({
      data: {
        slug: seed.slug,
        displayName: seed.displayName,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        partnershipType: seed.partnershipType,
        partnershipStart: new Date(`${seed.foundedYear + 10}-01-01`),
        foundedYear: seed.foundedYear,
        countryCode: seed.countryCode,
        city: seed.city,
        website: seed.website,
        verified: seed.verified,
        verifiedAt: seed.verified ? new Date() : null,
        featured: seed.featured,
        sortOrder: index,
        categories: { create: categories.map((c) => ({ categoryId: c.id })) },
        translations: {
          create: translationRows({
            en: {
              slug: seed.slug,
              name: seed.content.en.name,
              shortDescription: seed.content.en.short,
              specialization: seed.content.en.specialization,
              description: richDoc(seed.content.en.body) as object,
              highlights: [],
            },
            ru: {
              slug: null,
              name: seed.content.ru.name,
              shortDescription: seed.content.ru.short,
              specialization: seed.content.ru.specialization,
              description: richDoc(seed.content.ru.body) as object,
              highlights: [],
            },
            uz: {
              slug: null,
              name: seed.content.uz.name,
              shortDescription: seed.content.uz.short,
              specialization: seed.content.uz.specialization,
              description: richDoc(seed.content.uz.body) as object,
              highlights: [],
            },
            zh: {
              slug: null,
              name: seed.content.zh.name,
              shortDescription: seed.content.zh.short,
              specialization: seed.content.zh.specialization,
              description: richDoc(seed.content.zh.body) as object,
              highlights: [],
            },
          }),
        },
      },
      select: { id: true },
    })

    ids.set(seed.slug, partner.id)
  }

  return ids
}

interface BrandSeed {
  slug: string
  name: string
  partnerSlug: string
  countryCode: string
  featured: boolean
  content: Record<Locale, { short: string; tagline: string; body: string[] }>
}

const brands: BrandSeed[] = [
  {
    slug: 'norvenda',
    name: 'Norvenda',
    partnerSlug: 'norvenda-dental-systems',
    countryCode: 'DE',
    featured: true,
    content: {
      en: {
        short: 'Fictional brand of composites, adhesives and curing lights.',
        tagline: 'Restorative materials',
        body: [
          'Example brand page. A real one would carry the brand story, its product range, documentation and certifications.',
        ],
      },
      ru: {
        short: 'Вымышленный бренд композитов, адгезивов и фотополимерных ламп.',
        tagline: 'Реставрационные материалы',
        body: [
          'Пример страницы бренда. На реальной странице были бы история бренда, ассортимент, документация и сертификаты.',
        ],
      },
      uz: {
        short: 'Kompozit, adgeziv va fotopolimer lampalar brendining shartli sahifasi.',
        tagline: 'Restavratsion materiallar',
        body: [
          "Namunaviy brend sahifasi. Haqiqiy sahifada brend tarixi, assortiment, hujjatlar va sertifikatlar bo'ladi.",
        ],
      },
      zh: {
        short: '虚构品牌，涵盖复合树脂、粘接剂与光固化灯。',
        tagline: '修复材料',
        body: ['品牌页面示例。真实页面会包含品牌故事、产品线、技术文档与资质证书。'],
      },
    },
  },
  {
    slug: 'endoline',
    name: 'Endoline',
    partnerSlug: 'hanwoo-dental-tech',
    countryCode: 'KR',
    featured: true,
    content: {
      en: {
        short: 'Fictional endodontic brand: rotary files and obturation materials.',
        tagline: 'Endodontics',
        body: ['Example brand page demonstrating a single-discipline product range.'],
      },
      ru: {
        short:
          'Вымышленный эндодонтический бренд: машинные файлы и материалы для обтурации.',
        tagline: 'Эндодонтия',
        body: ['Пример страницы бренда с узкоспециализированным ассортиментом.'],
      },
      uz: {
        short:
          'Endodontik brendning shartli sahifasi: mashina fayllari va obturatsiya materiallari.',
        tagline: 'Endodontiya',
        body: ['Tor ixtisoslashgan assortimentga ega brend sahifasi namunasi.'],
      },
      zh: {
        short: '虚构牙髓品牌：机用锉与根管充填材料。',
        tagline: '牙髓治疗',
        body: ['展示单一学科产品线的品牌页面示例。'],
      },
    },
  },
  {
    slug: 'clarion',
    name: 'Clarion',
    partnerSlug: 'aurelio-medical-supplies',
    countryCode: 'IT',
    featured: true,
    content: {
      en: {
        short: 'Fictional brand of impression materials.',
        tagline: 'Impression materials',
        body: ['Example brand page.'],
      },
      ru: {
        short: 'Вымышленный бренд оттискных материалов.',
        tagline: 'Оттискные материалы',
        body: ['Пример страницы бренда.'],
      },
      uz: {
        short: 'Ottisk materiallari brendining shartli sahifasi.',
        tagline: 'Ottisk materiallari',
        body: ['Namunaviy brend sahifasi.'],
      },
      zh: { short: '虚构印模材料品牌。', tagline: '印模材料', body: ['品牌页面示例。'] },
    },
  },
  {
    slug: 'steriqo',
    name: 'Steriqo',
    partnerSlug: 'aurelio-medical-supplies',
    countryCode: 'IT',
    featured: false,
    content: {
      en: {
        short: 'Fictional infection-control brand.',
        tagline: 'Infection control',
        body: ['Example brand page.'],
      },
      ru: {
        short: 'Вымышленный бренд средств инфекционного контроля.',
        tagline: 'Инфекционный контроль',
        body: ['Пример страницы бренда.'],
      },
      uz: {
        short: 'Infeksiya nazorati vositalari brendining shartli sahifasi.',
        tagline: 'Infeksiya nazorati',
        body: ['Namunaviy brend sahifasi.'],
      },
      zh: { short: '虚构感染控制品牌。', tagline: '感染控制', body: ['品牌页面示例。'] },
    },
  },
]

export async function seedBrands(
  partnerIds: Map<string, string>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>()

  for (const [index, seed] of brands.entries()) {
    const existing = await db.brand.findUnique({
      where: { slug: seed.slug },
      select: { id: true },
    })

    if (existing) {
      ids.set(seed.slug, existing.id)
      continue
    }

    const brand = await db.brand.create({
      data: {
        slug: seed.slug,
        name: seed.name,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        partnerId: partnerIds.get(seed.partnerSlug) ?? null,
        countryCode: seed.countryCode,
        featured: seed.featured,
        sortOrder: index,
        translations: {
          create: translationRows({
            en: {
              slug: seed.slug,
              name: seed.name,
              shortDescription: seed.content.en.short,
              tagline: seed.content.en.tagline,
              description: richDoc(seed.content.en.body) as object,
            },
            ru: {
              slug: null,
              name: seed.name,
              shortDescription: seed.content.ru.short,
              tagline: seed.content.ru.tagline,
              description: richDoc(seed.content.ru.body) as object,
            },
            uz: {
              slug: null,
              name: seed.name,
              shortDescription: seed.content.uz.short,
              tagline: seed.content.uz.tagline,
              description: richDoc(seed.content.uz.body) as object,
            },
            zh: {
              slug: null,
              name: seed.name,
              shortDescription: seed.content.zh.short,
              tagline: seed.content.zh.tagline,
              description: richDoc(seed.content.zh.body) as object,
            },
          }),
        },
      },
      select: { id: true },
    })

    ids.set(seed.slug, brand.id)
  }

  return ids
}
