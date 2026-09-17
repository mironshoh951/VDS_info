import { db } from '../../src/server/db/client'
import { translationRows, richDoc } from './helpers'
import type { Locale } from '../../src/i18n/config'

/**
 * Pages, blocks, menus and forms.
 *
 * This is what makes the site visible. Every heading, button label and section
 * order below lives in the database and is editable from the admin panel —
 * none of it is compiled into the application (§8, §50, §79).
 */

type Quad<T> = Record<Locale, T>

interface BlockSeed {
  type: string
  anchor?: string
  /** Locale-independent configuration. */
  props: Record<string, unknown>
  /** Localized text. */
  text: Quad<Record<string, unknown>>
}

const homeBlocks: BlockSeed[] = [
  {
    type: 'hero',
    props: { align: 'left', primaryCtaHref: '/products', secondaryCtaHref: '/contact' },
    text: {
      en: {
        eyebrow: 'Dental supply',
        heading: 'Equipment and materials for modern dental practice',
        body: 'We supply dental clinics and laboratories with materials, instruments and equipment, and support them after the sale.',
        primaryCtaLabel: 'Browse products',
        secondaryCtaLabel: 'Contact us',
      },
      ru: {
        eyebrow: 'Стоматологическое снабжение',
        heading: 'Оборудование и материалы для современной стоматологии',
        body: 'Поставляем клиникам и лабораториям материалы, инструменты и оборудование и сопровождаем их после продажи.',
        primaryCtaLabel: 'Смотреть продукцию',
        secondaryCtaLabel: 'Связаться с нами',
      },
      uz: {
        eyebrow: "Stomatologik ta'minot",
        heading: 'Zamonaviy stomatologiya uchun uskuna va materiallar',
        body: "Klinika va laboratoriyalarni material, asbob va uskunalar bilan ta'minlaymiz hamda sotuvdan keyin qo'llab-quvvatlaymiz.",
        primaryCtaLabel: "Mahsulotlarni ko'rish",
        secondaryCtaLabel: "Biz bilan bog'lanish",
      },
      zh: {
        eyebrow: '牙科供应',
        heading: '为现代口腔诊疗提供设备与材料',
        body: '我们为诊所与技工室供应材料、器械与设备，并提供售后支持。',
        primaryCtaLabel: '浏览产品',
        secondaryCtaLabel: '联系我们',
      },
    },
  },
  {
    type: 'statistics',
    props: {},
    text: {
      // Deliberately empty. The block renders nothing until the company enters
      // its own figures — the platform does not invent statistics (§73).
      en: { heading: 'In numbers', items: [] },
      ru: { heading: 'В цифрах', items: [] },
      uz: { heading: 'Raqamlarda', items: [] },
      zh: { heading: '数据概览', items: [] },
    },
  },
  {
    type: 'featuredCategories',
    anchor: 'categories',
    props: { limit: 6 },
    text: {
      en: {
        heading: 'Product categories',
        body: 'Browse the catalogue by clinical discipline.',
      },
      ru: {
        heading: 'Категории продукции',
        body: 'Каталог по клиническим направлениям.',
      },
      uz: {
        heading: 'Mahsulot toifalari',
        body: "Katalogni klinik yo'nalishlar bo'yicha ko'ring.",
      },
      zh: { heading: '产品分类', body: '按临床学科浏览目录。' },
    },
  },
  {
    type: 'featuredProducts',
    anchor: 'products',
    props: { limit: 4, ctaHref: '/products' },
    text: {
      en: { heading: 'Featured products', ctaLabel: 'All products' },
      ru: { heading: 'Избранная продукция', ctaLabel: 'Вся продукция' },
      uz: { heading: 'Tanlangan mahsulotlar', ctaLabel: 'Barcha mahsulotlar' },
      zh: { heading: '精选产品', ctaLabel: '全部产品' },
    },
  },
  {
    type: 'servicesGrid',
    anchor: 'services',
    props: { limit: 4, ctaHref: '/services' },
    text: {
      en: { heading: 'What we do', ctaLabel: 'All services' },
      ru: { heading: 'Что мы делаем', ctaLabel: 'Все услуги' },
      uz: { heading: 'Biz nima qilamiz', ctaLabel: 'Barcha xizmatlar' },
      zh: { heading: '我们的服务', ctaLabel: '全部服务' },
    },
  },
  {
    type: 'featuredPartners',
    anchor: 'partners',
    props: { limit: 6, ctaHref: '/partners' },
    text: {
      en: {
        heading: 'Partners and manufacturers',
        body: 'We work with manufacturers, distributors and logistics partners.',
        ctaLabel: 'Partner directory',
      },
      ru: {
        heading: 'Партнёры и производители',
        body: 'Мы работаем с производителями, дистрибьюторами и логистическими партнёрами.',
        ctaLabel: 'Каталог партнёров',
      },
      uz: {
        heading: 'Hamkorlar va ishlab chiqaruvchilar',
        body: 'Ishlab chiqaruvchilar, distribyutorlar va logistika hamkorlari bilan ishlaymiz.',
        ctaLabel: 'Hamkorlar katalogi',
      },
      zh: {
        heading: '合作伙伴与制造商',
        body: '我们与制造商、经销商及物流伙伴合作。',
        ctaLabel: '合作伙伴目录',
      },
    },
  },
  {
    type: 'latestNews',
    anchor: 'news',
    props: { limit: 3, ctaHref: '/news' },
    text: {
      en: { heading: 'Latest news', ctaLabel: 'All news' },
      ru: { heading: 'Последние новости', ctaLabel: 'Все новости' },
      uz: { heading: "So'nggi yangiliklar", ctaLabel: 'Barcha yangiliklar' },
      zh: { heading: '最新动态', ctaLabel: '全部新闻' },
    },
  },
  {
    type: 'cta',
    props: { ctaHref: '/contact' },
    text: {
      en: {
        heading: 'Need a quotation or a recommendation?',
        body: 'Tell us what you are looking for and we will come back to you.',
        ctaLabel: 'Contact us',
      },
      ru: {
        heading: 'Нужно предложение или подбор?',
        body: 'Расскажите, что вам нужно, и мы вернёмся с ответом.',
        ctaLabel: 'Связаться с нами',
      },
      uz: {
        heading: 'Taklif yoki tavsiya kerakmi?',
        body: 'Nima izlayotganingizni ayting — javob bilan qaytamiz.',
        ctaLabel: "Biz bilan bog'lanish",
      },
      zh: {
        heading: '需要报价或选型建议？',
        body: '告诉我们您的需求，我们会尽快回复。',
        ctaLabel: '联系我们',
      },
    },
  },
]

const aboutBlocks: BlockSeed[] = [
  {
    type: 'hero',
    props: { align: 'left' },
    text: {
      en: { eyebrow: 'About us', heading: 'Who we are', body: '' },
      ru: { eyebrow: 'О компании', heading: 'Кто мы', body: '' },
      uz: { eyebrow: 'Kompaniya haqida', heading: 'Biz kimmiz', body: '' },
      zh: { eyebrow: '关于我们', heading: '我们是谁', body: '' },
    },
  },
  {
    type: 'richText',
    props: {},
    text: {
      en: {
        heading: 'Company overview',
        body: richDoc([
          'This section is empty on purpose. The company profile — history, mission, coverage, capabilities and quality standards — is written by the business and entered here through the admin panel.',
          'Nothing on this page is generated: a supplier’s "about" page is a set of claims, and claims have to come from the company that stands behind them.',
        ]),
      },
      ru: {
        heading: 'О компании',
        body: richDoc([
          'Раздел намеренно пуст. Профиль компании — история, миссия, география, возможности и стандарты качества — пишется бизнесом и вносится здесь через админ-панель.',
          'Ничего на этой странице не генерируется: страница «о компании» — это набор утверждений, а утверждения должны исходить от той компании, которая за них отвечает.',
        ]),
      },
      uz: {
        heading: 'Kompaniya haqida',
        body: richDoc([
          "Bu bo'lim ataylab bo'sh. Kompaniya profili — tarix, missiya, qamrov, imkoniyatlar va sifat standartlari — biznes tomonidan yoziladi va admin panel orqali kiritiladi.",
          "Bu sahifada hech narsa avtomatik yaratilmaydi: «kompaniya haqida» sahifasi — bu da'volar to'plami, da'volar esa ular uchun javob beradigan kompaniyadan kelishi kerak.",
        ]),
      },
      zh: {
        heading: '公司概况',
        body: richDoc([
          '本节刻意留空。公司简介——沿革、使命、覆盖区域、能力与质量标准——由企业撰写，并通过后台录入。',
          '本页内容不会自动生成："关于我们"是一组陈述，而陈述必须来自为之负责的企业本身。',
        ]),
      },
    },
  },
  {
    type: 'servicesGrid',
    props: { limit: 6, ctaHref: '/services' },
    text: {
      en: { heading: 'What we do', ctaLabel: 'All services' },
      ru: { heading: 'Чем мы занимаемся', ctaLabel: 'Все услуги' },
      uz: { heading: 'Biz nima qilamiz', ctaLabel: 'Barcha xizmatlar' },
      zh: { heading: '我们的服务', ctaLabel: '全部服务' },
    },
  },
]

const contactBlocks: BlockSeed[] = [
  {
    type: 'hero',
    props: { align: 'left' },
    text: {
      en: { eyebrow: 'Contact', heading: 'Get in touch', body: '' },
      ru: { eyebrow: 'Контакты', heading: 'Свяжитесь с нами', body: '' },
      uz: { eyebrow: 'Aloqa', heading: "Biz bilan bog'laning", body: '' },
      zh: { eyebrow: '联系', heading: '与我们联系', body: '' },
    },
  },
  {
    type: 'contact',
    props: { formKey: 'general-enquiry', showOffices: true },
    text: {
      en: { heading: 'Send an enquiry', officesHeading: 'Offices' },
      ru: { heading: 'Отправить обращение', officesHeading: 'Офисы' },
      uz: { heading: 'Murojaat yuborish', officesHeading: 'Ofislar' },
      zh: { heading: '发送咨询', officesHeading: '办事处' },
    },
  },
]

interface PageSeed {
  slug: string
  systemKey: string | null
  titles: Quad<{ title: string; subtitle?: string }>
  blocks: BlockSeed[]
}

const pages: PageSeed[] = [
  {
    slug: 'home',
    systemKey: 'home',
    titles: {
      en: { title: 'Home' },
      ru: { title: 'Главная' },
      uz: { title: 'Bosh sahifa' },
      zh: { title: '首页' },
    },
    blocks: homeBlocks,
  },
  {
    slug: 'about',
    systemKey: 'about',
    titles: {
      en: { title: 'About us' },
      ru: { title: 'О компании' },
      uz: { title: 'Kompaniya haqida' },
      zh: { title: '关于我们' },
    },
    blocks: aboutBlocks,
  },
  {
    slug: 'contact',
    systemKey: 'contact',
    titles: {
      en: { title: 'Contact' },
      ru: { title: 'Контакты' },
      uz: { title: 'Aloqa' },
      zh: { title: '联系方式' },
    },
    blocks: contactBlocks,
  },
]

export async function seedPages(): Promise<void> {
  for (const [index, seed] of pages.entries()) {
    const existing = await db.page.findUnique({
      where: { slug: seed.slug },
      select: { id: true },
    })
    if (existing) continue

    await db.page.create({
      data: {
        slug: seed.slug,
        systemKey: seed.systemKey,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        sortOrder: index,
        translations: {
          create: translationRows({
            en: {
              slug: seed.slug,
              title: seed.titles.en.title,
              subtitle: seed.titles.en.subtitle ?? null,
            },
            ru: {
              slug: null,
              title: seed.titles.ru.title,
              subtitle: seed.titles.ru.subtitle ?? null,
            },
            uz: {
              slug: null,
              title: seed.titles.uz.title,
              subtitle: seed.titles.uz.subtitle ?? null,
            },
            zh: {
              slug: null,
              title: seed.titles.zh.title,
              subtitle: seed.titles.zh.subtitle ?? null,
            },
          }),
        },
        blocks: {
          create: seed.blocks.map((block, order) => ({
            type: block.type,
            sortOrder: order,
            enabled: true,
            anchor: block.anchor ?? null,
            props: block.props as object,
            translations: {
              create: translationRows({
                en: { props: block.text.en as object },
                ru: { props: block.text.ru as object },
                uz: { props: block.text.uz as object },
                zh: { props: block.text.zh as object },
              }),
            },
          })),
        },
      },
    })
  }
}

interface MenuItemSeed {
  routeKey: string
  labels: Quad<string>
  children?: MenuItemSeed[]
}

const headerItems: MenuItemSeed[] = [
  {
    routeKey: 'about',
    labels: { en: 'About us', ru: 'О компании', uz: 'Kompaniya haqida', zh: '关于我们' },
  },
  {
    routeKey: 'products.index',
    labels: { en: 'Products', ru: 'Продукция', uz: 'Mahsulotlar', zh: '产品' },
  },
  {
    routeKey: 'brands.index',
    labels: { en: 'Brands', ru: 'Бренды', uz: 'Brendlar', zh: '品牌' },
  },
  {
    routeKey: 'partners.index',
    labels: { en: 'Partners', ru: 'Партнёры', uz: 'Hamkorlar', zh: '合作伙伴' },
  },
  {
    routeKey: 'services.index',
    labels: { en: 'Services', ru: 'Услуги', uz: 'Xizmatlar', zh: '服务' },
  },
  {
    routeKey: 'events.index',
    labels: { en: 'Events', ru: 'Мероприятия', uz: 'Tadbirlar', zh: '展会活动' },
  },
  {
    routeKey: 'news.index',
    labels: { en: 'News', ru: 'Новости', uz: 'Yangiliklar', zh: '新闻' },
  },
  {
    routeKey: 'contact',
    labels: { en: 'Contact', ru: 'Контакты', uz: 'Aloqa', zh: '联系' },
  },
]

const footerPrimaryItems: MenuItemSeed[] = [
  {
    routeKey: 'products.index',
    labels: { en: 'Products', ru: 'Продукция', uz: 'Mahsulotlar', zh: '产品' },
  },
  {
    routeKey: 'brands.index',
    labels: { en: 'Brands', ru: 'Бренды', uz: 'Brendlar', zh: '品牌' },
  },
  {
    routeKey: 'partners.index',
    labels: { en: 'Partners', ru: 'Партнёры', uz: 'Hamkorlar', zh: '合作伙伴' },
  },
  {
    routeKey: 'services.index',
    labels: { en: 'Services', ru: 'Услуги', uz: 'Xizmatlar', zh: '服务' },
  },
]

const footerSecondaryItems: MenuItemSeed[] = [
  {
    routeKey: 'about',
    labels: { en: 'About us', ru: 'О компании', uz: 'Kompaniya haqida', zh: '关于我们' },
  },
  {
    routeKey: 'events.index',
    labels: { en: 'Events', ru: 'Мероприятия', uz: 'Tadbirlar', zh: '展会活动' },
  },
  {
    routeKey: 'news.index',
    labels: { en: 'News', ru: 'Новости', uz: 'Yangiliklar', zh: '新闻' },
  },
  {
    routeKey: 'resources.index',
    labels: { en: 'Resources', ru: 'Материалы', uz: 'Materiallar', zh: '资料中心' },
  },
  {
    routeKey: 'certificates.index',
    labels: {
      en: 'Trust centre',
      ru: 'Центр доверия',
      uz: 'Ishonch markazi',
      zh: '信任中心',
    },
  },
]

const footerLegalItems: MenuItemSeed[] = [
  {
    routeKey: 'privacy',
    labels: { en: 'Privacy', ru: 'Конфиденциальность', uz: 'Maxfiylik', zh: '隐私政策' },
  },
  {
    routeKey: 'terms',
    labels: { en: 'Terms', ru: 'Условия', uz: 'Shartlar', zh: '使用条款' },
  },
  {
    routeKey: 'cookies',
    labels: { en: 'Cookies', ru: 'Cookie', uz: 'Cookie', zh: 'Cookie' },
  },
]

async function createMenu(
  key: string,
  name: string,
  location: 'HEADER' | 'FOOTER_PRIMARY' | 'FOOTER_SECONDARY' | 'FOOTER_LEGAL',
  items: MenuItemSeed[],
): Promise<void> {
  const existing = await db.menu.findUnique({ where: { key }, select: { id: true } })
  if (existing) return

  const menu = await db.menu.create({
    data: { key, name, location, enabled: true, isSystem: true },
    select: { id: true },
  })

  for (const [index, item] of items.entries()) {
    await db.menuItem.create({
      data: {
        menuId: menu.id,
        sortOrder: index,
        enabled: true,
        target: 'ROUTE',
        routeKey: item.routeKey,
        visibleLocales: [],
        translations: {
          create: translationRows({
            en: { label: item.labels.en, description: null, ariaLabel: null },
            ru: { label: item.labels.ru, description: null, ariaLabel: null },
            uz: { label: item.labels.uz, description: null, ariaLabel: null },
            zh: { label: item.labels.zh, description: null, ariaLabel: null },
          }),
        },
      },
    })
  }
}

export async function seedMenus(): Promise<void> {
  await createMenu('main-header', 'Main navigation', 'HEADER', headerItems)
  await createMenu(
    'footer-primary',
    'Footer — catalogue',
    'FOOTER_PRIMARY',
    footerPrimaryItems,
  )
  await createMenu(
    'footer-secondary',
    'Footer — company',
    'FOOTER_SECONDARY',
    footerSecondaryItems,
  )
  await createMenu('footer-legal', 'Footer — legal', 'FOOTER_LEGAL', footerLegalItems)
}

/**
 * The enquiry forms. Field labels are localized; validation rules are shared
 * between the browser and the server from the same definition (§21).
 */
export async function seedForms(): Promise<void> {
  const fields = [
    {
      key: 'name',
      type: 'TEXT' as const,
      required: true,
      width: 'half',
      validation: { minLength: 2, maxLength: 120 },
      labels: { en: 'Your name', ru: 'Ваше имя', uz: 'Ismingiz', zh: '您的姓名' },
    },
    {
      key: 'company',
      type: 'TEXT' as const,
      required: false,
      width: 'half',
      validation: { maxLength: 160 },
      labels: {
        en: 'Clinic or company',
        ru: 'Клиника или компания',
        uz: 'Klinika yoki kompaniya',
        zh: '诊所或公司',
      },
    },
    {
      key: 'email',
      type: 'EMAIL' as const,
      required: true,
      width: 'half',
      validation: {},
      labels: {
        en: 'Email',
        ru: 'Электронная почта',
        uz: 'Elektron pochta',
        zh: '电子邮箱',
      },
    },
    {
      key: 'phone',
      type: 'PHONE' as const,
      required: false,
      width: 'half',
      validation: { maxLength: 40 },
      labels: { en: 'Phone', ru: 'Телефон', uz: 'Telefon', zh: '电话' },
    },
    {
      key: 'message',
      type: 'TEXTAREA' as const,
      required: true,
      width: 'full',
      validation: { minLength: 10, maxLength: 4000 },
      labels: { en: 'Message', ru: 'Сообщение', uz: 'Xabar', zh: '留言内容' },
    },
    {
      key: 'consent',
      type: 'CONSENT' as const,
      required: true,
      width: 'full',
      validation: {},
      labels: {
        en: 'I agree that my details may be used to respond to this enquiry.',
        ru: 'Я согласен на использование моих данных для ответа на обращение.',
        uz: "Ma'lumotlarim ushbu murojaatga javob berish uchun ishlatilishiga roziman.",
        zh: '我同意将我的信息用于回复此次咨询。',
      },
    },
  ]

  const forms = [
    { key: 'general-enquiry', name: 'General enquiry', inquiryType: 'GENERAL' as const },
    { key: 'product-enquiry', name: 'Product enquiry', inquiryType: 'PRODUCT' as const },
    {
      key: 'partner-enquiry',
      name: 'Partnership enquiry',
      inquiryType: 'PARTNER' as const,
    },
  ]

  for (const form of forms) {
    const existing = await db.form.findUnique({
      where: { key: form.key },
      select: { id: true },
    })
    if (existing) continue

    await db.form.create({
      data: {
        key: form.key,
        name: form.name,
        enabled: true,
        isSystem: true,
        inquiryType: form.inquiryType,
        notifyEmails: [],
        fields: {
          create: fields.map((field, order) => ({
            key: field.key,
            type: field.type,
            required: field.required,
            sortOrder: order,
            enabled: true,
            width: field.width,
            validation: field.validation as object,
            translations: {
              create: translationRows({
                en: { label: field.labels.en, placeholder: null, helpText: null },
                ru: { label: field.labels.ru, placeholder: null, helpText: null },
                uz: { label: field.labels.uz, placeholder: null, helpText: null },
                zh: { label: field.labels.zh, placeholder: null, helpText: null },
              }),
            },
          })),
        },
      },
    })
  }
}
