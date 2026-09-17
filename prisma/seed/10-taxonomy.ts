import { db } from '../../src/server/db/client'
import { translationRows } from './helpers'
import type { Locale } from '../../src/i18n/config'

/**
 * Product and content taxonomy.
 *
 * These category names are industry-standard dental disciplines, not company
 * claims — they describe what the products are, which is a fact about
 * dentistry rather than an assertion about this business. Every one of them
 * remains editable and deletable from the admin panel.
 */

interface CategorySeed {
  slug: string
  iconKey: string
  names: Record<Locale, string>
  children?: CategorySeed[]
}

const productCategories: CategorySeed[] = [
  {
    slug: 'restorative-dentistry',
    iconKey: 'layers',
    names: {
      en: 'Restorative dentistry',
      ru: 'Терапевтическая стоматология',
      uz: 'Terapevtik stomatologiya',
      zh: '牙体修复',
    },
    children: [
      {
        slug: 'composites',
        iconKey: 'droplet',
        names: {
          en: 'Composites',
          ru: 'Композиты',
          uz: 'Kompozitlar',
          zh: '复合树脂',
        },
      },
      {
        slug: 'adhesives-and-bonding',
        iconKey: 'link',
        names: {
          en: 'Adhesives and bonding',
          ru: 'Адгезивы и бондинг',
          uz: 'Adgezivlar va bonding',
          zh: '粘接剂',
        },
      },
      {
        slug: 'glass-ionomers',
        iconKey: 'circle',
        names: {
          en: 'Glass ionomers',
          ru: 'Стеклоиономеры',
          uz: 'Shisha ionomerlar',
          zh: '玻璃离子',
        },
      },
    ],
  },
  {
    slug: 'endodontics',
    iconKey: 'git-branch',
    names: {
      en: 'Endodontics',
      ru: 'Эндодонтия',
      uz: 'Endodontiya',
      zh: '牙髓治疗',
    },
    children: [
      {
        slug: 'rotary-files',
        iconKey: 'rotate-cw',
        names: {
          en: 'Rotary files',
          ru: 'Машинные файлы',
          uz: 'Mashina fayllari',
          zh: '机用锉',
        },
      },
      {
        slug: 'obturation',
        iconKey: 'shield',
        names: {
          en: 'Obturation materials',
          ru: 'Материалы для обтурации',
          uz: 'Obturatsiya materiallari',
          zh: '根管充填材料',
        },
      },
    ],
  },
  {
    slug: 'prosthodontics',
    iconKey: 'box',
    names: {
      en: 'Prosthodontics',
      ru: 'Ортопедическая стоматология',
      uz: 'Ortopedik stomatologiya',
      zh: '口腔修复',
    },
    children: [
      {
        slug: 'impression-materials',
        iconKey: 'copy',
        names: {
          en: 'Impression materials',
          ru: 'Оттискные материалы',
          uz: 'Ottisk materiallari',
          zh: '印模材料',
        },
      },
    ],
  },
  {
    slug: 'implantology',
    iconKey: 'anchor',
    names: {
      en: 'Implantology',
      ru: 'Имплантология',
      uz: 'Implantologiya',
      zh: '种植学',
    },
  },
  {
    slug: 'orthodontics',
    iconKey: 'align-center',
    names: {
      en: 'Orthodontics',
      ru: 'Ортодонтия',
      uz: 'Ortodontiya',
      zh: '正畸',
    },
  },
  {
    slug: 'digital-dentistry',
    iconKey: 'scan',
    names: {
      en: 'Digital dentistry and CAD/CAM',
      ru: 'Цифровая стоматология и CAD/CAM',
      uz: 'Raqamli stomatologiya va CAD/CAM',
      zh: '数字化口腔与 CAD/CAM',
    },
  },
  {
    slug: 'dental-equipment',
    iconKey: 'monitor',
    names: {
      en: 'Dental equipment',
      ru: 'Стоматологическое оборудование',
      uz: 'Stomatologik uskunalar',
      zh: '牙科设备',
    },
    children: [
      {
        slug: 'dental-units',
        iconKey: 'armchair',
        names: {
          en: 'Dental units',
          ru: 'Стоматологические установки',
          uz: 'Stomatologik qurilmalar',
          zh: '牙科综合治疗台',
        },
      },
      {
        slug: 'imaging',
        iconKey: 'image',
        names: {
          en: 'Imaging systems',
          ru: 'Системы визуализации',
          uz: 'Tasvirlash tizimlari',
          zh: '影像系统',
        },
      },
    ],
  },
  {
    slug: 'infection-control',
    iconKey: 'shield-check',
    names: {
      en: 'Infection control',
      ru: 'Инфекционный контроль',
      uz: 'Infeksiya nazorati',
      zh: '感染控制',
    },
  },
  {
    slug: 'dental-laboratory',
    iconKey: 'flask-conical',
    names: {
      en: 'Dental laboratory',
      ru: 'Зуботехническая лаборатория',
      uz: 'Tish-texnik laboratoriyasi',
      zh: '技工室',
    },
  },
  {
    slug: 'consumables',
    iconKey: 'package',
    names: {
      en: 'Consumables',
      ru: 'Расходные материалы',
      uz: 'Sarflanuvchi materiallar',
      zh: '耗材',
    },
  },
]

async function createCategory(
  seed: CategorySeed,
  parentId: string | null,
  parentPath: string,
  depth: number,
  order: number,
): Promise<void> {
  const path = parentPath ? `${parentPath}/${seed.slug}` : seed.slug

  const existing = await db.productCategory.findUnique({
    where: { slug: seed.slug },
    select: { id: true },
  })

  const category =
    existing ??
    (await db.productCategory.create({
      data: {
        slug: seed.slug,
        parentId,
        path,
        depth,
        iconKey: seed.iconKey,
        sortOrder: order,
        enabled: true,
        featured: depth === 0 && order < 6,
        translations: {
          create: translationRows({
            en: { name: seed.names.en, slug: seed.slug },
            ru: { name: seed.names.ru, slug: null },
            uz: { name: seed.names.uz, slug: null },
            zh: { name: seed.names.zh, slug: null },
          }),
        },
      },
      select: { id: true },
    }))

  for (const [index, child] of (seed.children ?? []).entries()) {
    await createCategory(child, category.id, path, depth + 1, index)
  }
}

export async function seedProductCategories(): Promise<void> {
  for (const [index, category] of productCategories.entries()) {
    await createCategory(category, null, '', 0, index)
  }
}

const partnerCategories: Array<{ slug: string; names: Record<Locale, string> }> = [
  {
    slug: 'manufacturers',
    names: {
      en: 'Manufacturers',
      ru: 'Производители',
      uz: 'Ishlab chiqaruvchilar',
      zh: '生产商',
    },
  },
  {
    slug: 'equipment-suppliers',
    names: {
      en: 'Equipment suppliers',
      ru: 'Поставщики оборудования',
      uz: 'Uskuna yetkazib beruvchilar',
      zh: '设备供应商',
    },
  },
  {
    slug: 'education-partners',
    names: {
      en: 'Education partners',
      ru: 'Образовательные партнёры',
      uz: "Ta'lim hamkorlari",
      zh: '教育合作伙伴',
    },
  },
  {
    slug: 'logistics',
    names: {
      en: 'Logistics',
      ru: 'Логистика',
      uz: 'Logistika',
      zh: '物流',
    },
  },
]

export async function seedPartnerCategories(): Promise<void> {
  for (const [index, category] of partnerCategories.entries()) {
    const existing = await db.partnerCategory.findUnique({
      where: { slug: category.slug },
      select: { id: true },
    })
    if (existing) continue

    await db.partnerCategory.create({
      data: {
        slug: category.slug,
        sortOrder: index,
        translations: {
          create: translationRows({
            en: { name: category.names.en, slug: category.slug },
            ru: { name: category.names.ru, slug: null },
            uz: { name: category.names.uz, slug: null },
            zh: { name: category.names.zh, slug: null },
          }),
        },
      },
    })
  }
}

const articleCategories = [
  {
    slug: 'company-news',
    names: {
      en: 'Company news',
      ru: 'Новости компании',
      uz: 'Kompaniya yangiliklari',
      zh: '公司新闻',
    },
  },
  {
    slug: 'industry',
    names: {
      en: 'Industry',
      ru: 'Отрасль',
      uz: 'Soha',
      zh: '行业动态',
    },
  },
  {
    slug: 'events',
    names: {
      en: 'Events',
      ru: 'Мероприятия',
      uz: 'Tadbirlar',
      zh: '展会活动',
    },
  },
  {
    slug: 'product-updates',
    names: {
      en: 'Product updates',
      ru: 'Обновления продукции',
      uz: 'Mahsulot yangilanishlari',
      zh: '产品更新',
    },
  },
]

export async function seedArticleCategories(): Promise<void> {
  for (const [index, category] of articleCategories.entries()) {
    await db.articleCategory.upsert({
      where: { slug: category.slug },
      create: { slug: category.slug, sortOrder: index, names: category.names },
      update: { names: category.names },
    })
  }
}

/**
 * Filterable product attributes (§53). Adding another facet later is an admin
 * action; these are simply the ones a dental catalogue needs on day one.
 */
export async function seedProductAttributes(): Promise<void> {
  const attributes = [
    {
      key: 'treatment-area',
      dataType: 'multiselect',
      labels: {
        en: 'Treatment area',
        ru: 'Область применения',
        uz: "Qo'llanish sohasi",
        zh: '治疗领域',
      },
      options: [
        {
          value: 'anterior',
          labels: {
            en: 'Anterior',
            ru: 'Фронтальный отдел',
            uz: 'Old tishlar',
            zh: '前牙',
          },
        },
        {
          value: 'posterior',
          labels: {
            en: 'Posterior',
            ru: 'Жевательный отдел',
            uz: 'Orqa tishlar',
            zh: '后牙',
          },
        },
        {
          value: 'root-canal',
          labels: {
            en: 'Root canal',
            ru: 'Корневой канал',
            uz: 'Ildiz kanali',
            zh: '根管',
          },
        },
      ],
    },
    {
      key: 'technology',
      dataType: 'select',
      labels: { en: 'Technology', ru: 'Технология', uz: 'Texnologiya', zh: '技术' },
      options: [
        {
          value: 'light-cure',
          labels: {
            en: 'Light cure',
            ru: 'Светового отверждения',
            uz: "Yorug'likda qotadigan",
            zh: '光固化',
          },
        },
        {
          value: 'self-cure',
          labels: {
            en: 'Self cure',
            ru: 'Самоотверждаемый',
            uz: "O'z-o'zidan qotadigan",
            zh: '自固化',
          },
        },
        {
          value: 'dual-cure',
          labels: {
            en: 'Dual cure',
            ru: 'Двойного отверждения',
            uz: 'Ikki tomonlama qotadigan',
            zh: '双固化',
          },
        },
      ],
    },
    {
      key: 'sterilizable',
      dataType: 'boolean',
      labels: {
        en: 'Sterilizable',
        ru: 'Стерилизуемый',
        uz: 'Sterilizatsiya qilinadi',
        zh: '可灭菌',
      },
      options: null,
    },
  ]

  for (const [index, attribute] of attributes.entries()) {
    await db.productAttribute.upsert({
      where: { key: attribute.key },
      create: {
        key: attribute.key,
        dataType: attribute.dataType,
        filterable: true,
        sortOrder: index,
        labels: attribute.labels,
        options: (attribute.options ?? undefined) as object | undefined,
      },
      update: {
        labels: attribute.labels,
        options: (attribute.options ?? undefined) as object | undefined,
      },
    })
  }
}
