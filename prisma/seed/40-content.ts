import { db } from '../../src/server/db/client'
import { translationRows, richDoc } from './helpers'
import type { Locale } from '../../src/i18n/config'

/**
 * Services, events, news, resources, trust documents and company profile.
 *
 * ⚠ Illustrative content. No event attendance, award, certification or
 * statistic below is a factual claim about this company — each is a visible
 * placeholder the business replaces with its own records.
 */

type Quad<T> = Record<Locale, T>

interface ServiceSeed {
  slug: string
  iconKey: string
  featured: boolean
  content: Quad<{
    name: string
    short: string
    benefits: string[]
    steps: { title: string; description: string }[]
  }>
}

const services: ServiceSeed[] = [
  {
    slug: 'product-supply',
    iconKey: 'truck',
    featured: true,
    content: {
      en: {
        name: 'Product supply',
        short:
          'Supply of dental materials, instruments and consumables to clinics and laboratories.',
        benefits: [
          'Consolidated ordering across brands',
          'Stock planning for recurring items',
        ],
        steps: [
          {
            title: 'Request',
            description: 'You send a list of what you need, or ask for a recommendation.',
          },
          {
            title: 'Quotation',
            description: 'We confirm availability, lead time and pricing.',
          },
          {
            title: 'Delivery',
            description: 'Goods are delivered with the accompanying documentation.',
          },
        ],
      },
      ru: {
        name: 'Поставка продукции',
        short:
          'Поставка стоматологических материалов, инструментов и расходников клиникам и лабораториям.',
        benefits: [
          'Единый заказ по нескольким брендам',
          'Планирование остатков по регулярным позициям',
        ],
        steps: [
          {
            title: 'Заявка',
            description: 'Вы присылаете перечень или запрашиваете подбор.',
          },
          {
            title: 'Коммерческое предложение',
            description: 'Подтверждаем наличие, сроки и стоимость.',
          },
          { title: 'Доставка', description: 'Отгрузка с сопроводительными документами.' },
        ],
      },
      uz: {
        name: 'Mahsulot yetkazib berish',
        short:
          'Klinika va laboratoriyalarga stomatologik material, asbob va sarf materiallari yetkazib berish.',
        benefits: [
          "Bir nechta brend bo'yicha yagona buyurtma",
          'Doimiy pozitsiyalar bo’yicha qoldiq rejalashtirish',
        ],
        steps: [
          {
            title: 'Ariza',
            description: "Ro'yxat yuborasiz yoki tanlab berishni so'raysiz.",
          },
          {
            title: 'Tijorat taklifi',
            description: 'Mavjudlik, muddat va narxni tasdiqlaymiz.',
          },
          {
            title: 'Yetkazib berish',
            description: 'Tovar hamrohlik hujjatlari bilan yetkaziladi.',
          },
        ],
      },
      zh: {
        name: '产品供应',
        short: '为诊所与技工室供应牙科材料、器械与耗材。',
        benefits: ['跨品牌统一下单', '常用品项的库存规划'],
        steps: [
          { title: '需求', description: '您发送清单，或请我们推荐。' },
          { title: '报价', description: '我们确认供货情况、交期与价格。' },
          { title: '交付', description: '随货提供相关文件。' },
        ],
      },
    },
  },
  {
    slug: 'equipment-installation',
    iconKey: 'wrench',
    featured: true,
    content: {
      en: {
        name: 'Equipment supply and installation',
        short: 'Selection, delivery, installation and commissioning of dental equipment.',
        benefits: ['Site assessment before purchase', 'Installation and handover'],
        steps: [
          {
            title: 'Assessment',
            description: 'We review the site requirements and constraints.',
          },
          {
            title: 'Installation',
            description: 'Equipment is installed and commissioned.',
          },
          {
            title: 'Handover',
            description: 'Operating instructions and documentation are provided.',
          },
        ],
      },
      ru: {
        name: 'Поставка и монтаж оборудования',
        short:
          'Подбор, поставка, монтаж и ввод в эксплуатацию стоматологического оборудования.',
        benefits: [
          'Обследование площадки до покупки',
          'Монтаж и передача в эксплуатацию',
        ],
        steps: [
          {
            title: 'Обследование',
            description: 'Изучаем требования и ограничения площадки.',
          },
          {
            title: 'Монтаж',
            description: 'Оборудование монтируется и вводится в работу.',
          },
          { title: 'Передача', description: 'Передаём инструкции и документацию.' },
        ],
      },
      uz: {
        name: "Uskuna yetkazib berish va o'rnatish",
        short:
          "Stomatologik uskunani tanlash, yetkazib berish, o'rnatish va ishga tushirish.",
        benefits: ['Sotib olishdan oldin joyni baholash', "O'rnatish va topshirish"],
        steps: [
          {
            title: 'Baholash',
            description: "Joy talablari va cheklovlarini o'rganamiz.",
          },
          { title: "O'rnatish", description: 'Uskuna o’rnatiladi va ishga tushiriladi.' },
          { title: 'Topshirish', description: "Yo'riqnoma va hujjatlar topshiriladi." },
        ],
      },
      zh: {
        name: '设备供应与安装',
        short: '牙科设备的选型、供货、安装与调试。',
        benefits: ['采购前现场勘查', '安装与交付'],
        steps: [
          { title: '勘查', description: '评估现场条件与限制。' },
          { title: '安装', description: '完成设备安装与调试。' },
          { title: '交付', description: '提供操作说明与文件。' },
        ],
      },
    },
  },
  {
    slug: 'technical-support',
    iconKey: 'life-buoy',
    featured: true,
    content: {
      en: {
        name: 'Technical support',
        short: 'After-sales support, maintenance and spare parts for supplied equipment.',
        benefits: ['Single point of contact', 'Spare parts sourcing'],
        steps: [
          { title: 'Report', description: 'You describe the fault.' },
          { title: 'Diagnosis', description: 'We diagnose remotely or on site.' },
          {
            title: 'Resolution',
            description: 'Repair, part replacement or manufacturer escalation.',
          },
        ],
      },
      ru: {
        name: 'Техническая поддержка',
        short:
          'Постпродажная поддержка, обслуживание и запчасти для поставленного оборудования.',
        benefits: ['Единая точка обращения', 'Подбор запасных частей'],
        steps: [
          { title: 'Обращение', description: 'Вы описываете неисправность.' },
          { title: 'Диагностика', description: 'Диагностируем удалённо или на месте.' },
          {
            title: 'Решение',
            description: 'Ремонт, замена части или обращение к производителю.',
          },
        ],
      },
      uz: {
        name: 'Texnik qo’llab-quvvatlash',
        short:
          "Yetkazilgan uskuna bo'yicha sotuvdan keyingi xizmat, texnik xizmat va ehtiyot qismlar.",
        benefits: ['Yagona murojaat nuqtasi', 'Ehtiyot qismlarni topish'],
        steps: [
          { title: 'Murojaat', description: 'Nosozlikni tasvirlab berasiz.' },
          { title: 'Diagnostika', description: 'Masofadan yoki joyida aniqlaymiz.' },
          {
            title: 'Yechim',
            description:
              "Ta'mirlash, qism almashtirish yoki ishlab chiqaruvchiga murojaat.",
          },
        ],
      },
      zh: {
        name: '技术支持',
        short: '所供设备的售后支持、维护与备件。',
        benefits: ['单一联络窗口', '备件采购'],
        steps: [
          { title: '报修', description: '您描述故障情况。' },
          { title: '诊断', description: '远程或现场诊断。' },
          { title: '处理', description: '维修、更换部件或升级至制造商。' },
        ],
      },
    },
  },
  {
    slug: 'training-and-demonstration',
    iconKey: 'graduation-cap',
    featured: false,
    content: {
      en: {
        name: 'Training and product demonstration',
        short: 'Hands-on demonstrations and training sessions for clinical teams.',
        benefits: [
          'Sessions at your clinic or ours',
          'Manufacturer-led sessions where available',
        ],
        steps: [
          { title: 'Plan', description: 'We agree the topic, audience and date.' },
          {
            title: 'Session',
            description: 'The demonstration or training is delivered.',
          },
          {
            title: 'Follow-up',
            description: 'Materials and answers to open questions are shared.',
          },
        ],
      },
      ru: {
        name: 'Обучение и демонстрация продукции',
        short: 'Практические демонстрации и обучающие сессии для клинических команд.',
        benefits: [
          'Сессии в вашей клинике или у нас',
          'Мероприятия с участием производителя',
        ],
        steps: [
          { title: 'Планирование', description: 'Согласуем тему, аудиторию и дату.' },
          { title: 'Сессия', description: 'Проводим демонстрацию или обучение.' },
          { title: 'Итоги', description: 'Передаём материалы и ответы на вопросы.' },
        ],
      },
      uz: {
        name: "O'quv va mahsulot namoyishi",
        short: 'Klinika jamoalari uchun amaliy namoyish va o’quv sessiyalari.',
        benefits: [
          'Sizning klinikangizda yoki bizda',
          'Imkon bo’lsa ishlab chiqaruvchi ishtirokida',
        ],
        steps: [
          {
            title: 'Rejalashtirish',
            description: 'Mavzu, auditoriya va sanani kelishamiz.',
          },
          { title: 'Sessiya', description: "Namoyish yoki o'quv o'tkaziladi." },
          {
            title: 'Yakun',
            description: 'Materiallar va savollarga javoblar yuboriladi.',
          },
        ],
      },
      zh: {
        name: '培训与产品演示',
        short: '面向临床团队的实操演示与培训。',
        benefits: ['可在贵诊所或我方场地举办', '条件允许时由制造商主讲'],
        steps: [
          { title: '计划', description: '确定主题、对象与日期。' },
          { title: '实施', description: '开展演示或培训。' },
          { title: '跟进', description: '提供资料并解答遗留问题。' },
        ],
      },
    },
  },
]

export async function seedServices(): Promise<Map<string, string>> {
  const ids = new Map<string, string>()

  for (const [index, seed] of services.entries()) {
    const existing = await db.service.findUnique({
      where: { slug: seed.slug },
      select: { id: true },
    })
    if (existing) {
      ids.set(seed.slug, existing.id)
      continue
    }

    const service = await db.service.create({
      data: {
        slug: seed.slug,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        iconKey: seed.iconKey,
        featured: seed.featured,
        sortOrder: index,
        translations: {
          create: translationRows({
            en: {
              slug: seed.slug,
              name: seed.content.en.name,
              shortDescription: seed.content.en.short,
              description: richDoc([seed.content.en.short]) as object,
              benefits: seed.content.en.benefits,
              processSteps: seed.content.en.steps as unknown as object,
            },
            ru: {
              slug: null,
              name: seed.content.ru.name,
              shortDescription: seed.content.ru.short,
              description: richDoc([seed.content.ru.short]) as object,
              benefits: seed.content.ru.benefits,
              processSteps: seed.content.ru.steps as unknown as object,
            },
            uz: {
              slug: null,
              name: seed.content.uz.name,
              shortDescription: seed.content.uz.short,
              description: richDoc([seed.content.uz.short]) as object,
              benefits: seed.content.uz.benefits,
              processSteps: seed.content.uz.steps as unknown as object,
            },
            zh: {
              slug: null,
              name: seed.content.zh.name,
              shortDescription: seed.content.zh.short,
              description: richDoc([seed.content.zh.short]) as object,
              benefits: seed.content.zh.benefits,
              processSteps: seed.content.zh.steps as unknown as object,
            },
          }),
        },
      },
      select: { id: true },
    })

    ids.set(seed.slug, service.id)
  }

  return ids
}

export async function seedEvents(partnerIds: Map<string, string>): Promise<void> {
  const now = new Date()
  const year = now.getFullYear()

  const events = [
    {
      slug: 'example-dental-expo',
      type: 'EXHIBITION' as const,
      participation: 'EXHIBITOR' as const,
      start: new Date(`${year}-11-12T09:00:00Z`),
      end: new Date(`${year}-11-15T18:00:00Z`),
      countryCode: 'UZ',
      city: 'Tashkent',
      venue: 'Example Exhibition Centre',
      booth: 'B-14',
      featured: true,
      partners: ['norvenda-dental-systems', 'hanwoo-dental-tech'],
      content: {
        en: {
          title: 'Example Dental Expo',
          short:
            'Placeholder exhibition entry showing an upcoming event with booth details.',
          body: 'Replace with a real event. The template shows dates, venue, participation type, booth number, linked partners and products, a gallery and downloadable materials.',
        },
        ru: {
          title: 'Example Dental Expo',
          short: 'Демонстрационная запись выставки с информацией о стенде.',
          body: 'Замените реальным мероприятием. Шаблон показывает даты, площадку, тип участия, номер стенда, связанных партнёров и продукты, галерею и материалы для скачивания.',
        },
        uz: {
          title: 'Example Dental Expo',
          short: "Stend ma'lumotlari bilan ko'rgazma yozuvining namunasi.",
          body: "Haqiqiy tadbir bilan almashtiring. Shablon sana, joy, ishtirok turi, stend raqami, bog'langan hamkor va mahsulotlar, galereya hamda yuklab olinadigan materiallarni ko'rsatadi.",
        },
        zh: {
          title: 'Example Dental Expo',
          short: '展会条目示例，包含展位信息。',
          body: '请替换为真实展会。模板展示日期、场馆、参与形式、展位号、关联的合作伙伴与产品、图库及可下载资料。',
        },
      },
    },
    {
      slug: 'example-endodontics-workshop',
      type: 'WORKSHOP' as const,
      participation: 'ORGANIZER' as const,
      start: new Date(`${year}-03-20T10:00:00Z`),
      end: new Date(`${year}-03-20T17:00:00Z`),
      countryCode: 'UZ',
      city: 'Samarkand',
      venue: 'Example Training Centre',
      booth: null,
      featured: false,
      partners: ['hanwoo-dental-tech'],
      content: {
        en: {
          title: 'Example Endodontics Workshop',
          short: 'Placeholder past-event entry, used to show the archive view.',
          body: 'A past event carries a summary written after it took place, plus photographs and any materials shared with attendees.',
        },
        ru: {
          title: 'Example Endodontics Workshop',
          short: 'Демонстрационная запись прошедшего мероприятия для архивного вида.',
          body: 'У прошедшего мероприятия есть итоговый текст, фотографии и материалы, переданные участникам.',
        },
        uz: {
          title: 'Example Endodontics Workshop',
          short: "Arxiv ko'rinishini ko'rsatish uchun o'tgan tadbir yozuvi.",
          body: "O'tgan tadbirda yakuniy matn, suratlar va ishtirokchilarga berilgan materiallar bo'ladi.",
        },
        zh: {
          title: 'Example Endodontics Workshop',
          short: '往期活动条目示例，用于展示归档视图。',
          body: '往期活动包含会后撰写的总结、照片以及分发给参会者的资料。',
        },
      },
    },
  ]

  for (const seed of events) {
    const existing = await db.event.findUnique({
      where: { slug: seed.slug },
      select: { id: true },
    })
    if (existing) continue

    const linkedPartners = seed.partners
      .map((slug) => partnerIds.get(slug))
      .filter((id): id is string => Boolean(id))

    await db.event.create({
      data: {
        slug: seed.slug,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        type: seed.type,
        participation: seed.participation,
        startDate: seed.start,
        endDate: seed.end,
        timezone: 'Asia/Tashkent',
        countryCode: seed.countryCode,
        city: seed.city,
        venue: seed.venue,
        boothNumber: seed.booth,
        featured: seed.featured,
        partners: { create: linkedPartners.map((partnerId) => ({ partnerId })) },
        translations: {
          create: translationRows({
            en: {
              slug: seed.slug,
              title: seed.content.en.title,
              shortDescription: seed.content.en.short,
              description: richDoc([seed.content.en.body]) as object,
            },
            ru: {
              slug: null,
              title: seed.content.ru.title,
              shortDescription: seed.content.ru.short,
              description: richDoc([seed.content.ru.body]) as object,
            },
            uz: {
              slug: null,
              title: seed.content.uz.title,
              shortDescription: seed.content.uz.short,
              description: richDoc([seed.content.uz.body]) as object,
            },
            zh: {
              slug: null,
              title: seed.content.zh.title,
              shortDescription: seed.content.zh.short,
              description: richDoc([seed.content.zh.body]) as object,
            },
          }),
        },
      },
    })
  }
}

export async function seedArticles(productIds: Map<string, string>): Promise<void> {
  const categories = await db.articleCategory.findMany({
    select: { id: true, slug: true },
  })
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]))

  const articles = [
    {
      slug: 'welcome-to-the-new-platform',
      categorySlug: 'company-news',
      daysAgo: 3,
      featured: true,
      products: [] as string[],
      content: {
        en: {
          title: 'Welcome to the new platform',
          excerpt: 'A placeholder article showing how the publishing system works.',
          body: [
            'This entry exists so the news listing, the article template, reading-time estimation and the relationship to products and partners can be seen working.',
            'Replace it with real company news. Articles support draft, review, scheduled, published and archived states, with version history for every change.',
          ],
        },
        ru: {
          title: 'Добро пожаловать на новую платформу',
          excerpt: 'Демонстрационная статья, показывающая работу системы публикаций.',
          body: [
            'Эта запись нужна, чтобы увидеть список новостей, шаблон статьи, расчёт времени чтения и связи с продуктами и партнёрами.',
            'Замените её реальными новостями компании. Статьи поддерживают статусы «черновик», «на проверке», «запланировано», «опубликовано» и «в архиве», а также историю версий.',
          ],
        },
        uz: {
          title: 'Yangi platformaga xush kelibsiz',
          excerpt: 'Nashr tizimi ishlashini ko’rsatuvchi namunaviy maqola.',
          body: [
            "Bu yozuv yangiliklar ro'yxati, maqola shabloni, o'qish vaqti hisobi hamda mahsulot va hamkorlar bilan bog'liqlikni ko'rish uchun kerak.",
            "Uni kompaniyaning haqiqiy yangiliklari bilan almashtiring. Maqolalar «qoralama», «tekshiruvda», «rejalashtirilgan», «chop etilgan» va «arxiv» holatlarini hamda versiyalar tarixini qo'llab-quvvatlaydi.",
          ],
        },
        zh: {
          title: '欢迎使用新平台',
          excerpt: '用于演示发布系统的占位文章。',
          body: [
            '该条目用于展示新闻列表、文章模板、阅读时长估算以及与产品和合作伙伴的关联。',
            '请替换为真实的公司新闻。文章支持草稿、待审、定时、已发布与归档状态，并为每次修改保留版本历史。',
          ],
        },
      },
    },
    {
      slug: 'choosing-composite-materials',
      categorySlug: 'industry',
      daysAgo: 18,
      featured: false,
      products: ['norvenda-composite-nx', 'norvenda-bond-universal'],
      content: {
        en: {
          title: 'How the catalogue links articles to products',
          excerpt: 'An example of an article connected to specific catalogue entries.',
          body: [
            'This article is linked to two products. On the article page those appear as related product cards; on each product page this article appears under related reading.',
            'The relationship is editorial — someone chooses it in the admin panel. Nothing is inferred automatically, because a wrong automatic link in a medical-adjacent catalogue is worse than no link.',
          ],
        },
        ru: {
          title: 'Как каталог связывает статьи с продуктами',
          excerpt: 'Пример статьи, связанной с конкретными позициями каталога.',
          body: [
            'Эта статья связана с двумя продуктами. На странице статьи они показываются карточками, а на странице продукта статья появляется в разделе «по теме».',
            'Связь редакторская — её выбирает человек в админ-панели. Автоматических связей нет: в каталоге медицинского профиля ошибочная связь хуже, чем её отсутствие.',
          ],
        },
        uz: {
          title: "Katalog maqolalarni mahsulotlar bilan qanday bog'laydi",
          excerpt: "Katalogning aniq pozitsiyalari bilan bog'langan maqola namunasi.",
          body: [
            "Bu maqola ikkita mahsulot bilan bog'langan. Maqola sahifasida ular kartochka sifatida, mahsulot sahifasida esa maqola «mavzuga oid» bo'limida chiqadi.",
            "Bog'liqlik muharrirlik qarori — uni admin panelda odam tanlaydi. Avtomatik bog'lanish yo'q: tibbiyotga yaqin katalogda noto'g'ri bog'lanish bog'lanish yo'qligidan yomonroq.",
          ],
        },
        zh: {
          title: '目录如何将文章与产品关联',
          excerpt: '与具体目录条目关联的文章示例。',
          body: [
            '本文关联了两款产品。文章页以卡片形式展示它们，产品页则在"相关阅读"中显示本文。',
            '该关联由编辑在后台选择，不做自动推断——在医疗相关目录中，错误的自动关联比没有关联更糟。',
          ],
        },
      },
    },
  ]

  for (const seed of articles) {
    const existing = await db.article.findUnique({
      where: { slug: seed.slug },
      select: { id: true },
    })
    if (existing) continue

    const publishedAt = new Date(Date.now() - seed.daysAgo * 24 * 60 * 60 * 1000)
    const linkedProducts = seed.products
      .map((slug) => productIds.get(slug))
      .filter((id): id is string => Boolean(id))

    await db.article.create({
      data: {
        slug: seed.slug,
        status: 'PUBLISHED',
        publishedAt,
        categoryId: categoryBySlug.get(seed.categorySlug) ?? null,
        featured: seed.featured,
        products: { create: linkedProducts.map((productId) => ({ productId })) },
        translations: {
          create: translationRows({
            en: {
              slug: seed.slug,
              title: seed.content.en.title,
              excerpt: seed.content.en.excerpt,
              content: richDoc(seed.content.en.body) as object,
              readingMinutes: 2,
            },
            ru: {
              slug: null,
              title: seed.content.ru.title,
              excerpt: seed.content.ru.excerpt,
              content: richDoc(seed.content.ru.body) as object,
              readingMinutes: 2,
            },
            uz: {
              slug: null,
              title: seed.content.uz.title,
              excerpt: seed.content.uz.excerpt,
              content: richDoc(seed.content.uz.body) as object,
              readingMinutes: 2,
            },
            zh: {
              slug: null,
              title: seed.content.zh.title,
              excerpt: seed.content.zh.excerpt,
              content: richDoc(seed.content.zh.body) as object,
              readingMinutes: 2,
            },
          }),
        },
      },
    })
  }
}

export async function seedCertificates(): Promise<void> {
  // Titles say plainly that these are placeholders. A fabricated certificate
  // on a dental supplier's trust page would be a serious misrepresentation.
  const certificates = [
    {
      slug: 'placeholder-quality-certificate',
      kind: 'CERTIFICATE',
      titles: {
        en: 'Placeholder — upload your quality certificate here',
        ru: 'Заглушка — загрузите сюда ваш сертификат качества',
        uz: 'Vaqtinchalik — sifat sertifikatingizni shu yerga yuklang',
        zh: '占位条目 — 请在此上传贵司质量证书',
      },
    },
    {
      slug: 'placeholder-business-licence',
      kind: 'LICENSE',
      titles: {
        en: 'Placeholder — upload your business licence here',
        ru: 'Заглушка — загрузите сюда лицензию на деятельность',
        uz: 'Vaqtinchalik — faoliyat litsenziyangizni shu yerga yuklang',
        zh: '占位条目 — 请在此上传营业执照',
      },
    },
  ]

  for (const [index, seed] of certificates.entries()) {
    const existing = await db.certificate.findUnique({
      where: { slug: seed.slug },
      select: { id: true },
    })
    if (existing) continue

    await db.certificate.create({
      data: {
        slug: seed.slug,
        // Drafts, not published: nothing that looks like a credential goes
        // live until a real document replaces it.
        status: 'DRAFT',
        kind: seed.kind,
        sortOrder: index,
        translations: {
          create: translationRows({
            en: { slug: seed.slug, title: seed.titles.en, description: null },
            ru: { slug: null, title: seed.titles.ru, description: null },
            uz: { slug: null, title: seed.titles.uz, description: null },
            zh: { slug: null, title: seed.titles.zh, description: null },
          }),
        },
      },
    })
  }
}

export async function seedFaqs(serviceIds: Map<string, string>): Promise<void> {
  const faqs = [
    {
      slug: 'how-to-request-a-quotation',
      serviceSlug: 'product-supply',
      content: {
        en: {
          q: 'How do I request a quotation?',
          a: 'Use the contact form on any product page, or the general enquiry form. Every submission is stored and answered by the sales team.',
        },
        ru: {
          q: 'Как запросить коммерческое предложение?',
          a: 'Используйте форму на странице продукта или общую форму обращения. Каждое обращение сохраняется и обрабатывается отделом продаж.',
        },
        uz: {
          q: 'Tijorat taklifini qanday so’rayman?',
          a: "Har qanday mahsulot sahifasidagi shakldan yoki umumiy murojaat shaklidan foydalaning. Har bir murojaat saqlanadi va sotuv bo'limi javob beradi.",
        },
        zh: {
          q: '如何索取报价？',
          a: '可在任意产品页使用联系表单，或使用通用咨询表单。每条提交都会保存并由销售团队回复。',
        },
      },
    },
    {
      slug: 'do-you-deliver-outside-tashkent',
      serviceSlug: 'product-supply',
      content: {
        en: {
          q: 'Do you deliver outside Tashkent?',
          a: 'Delivery coverage is set by the company and shown on the contact page. This answer is a placeholder until it is filled in.',
        },
        ru: {
          q: 'Осуществляется ли доставка за пределы Ташкента?',
          a: 'Зона доставки определяется компанией и указывается на странице контактов. Этот ответ — заглушка до заполнения.',
        },
        uz: {
          q: 'Toshkentdan tashqariga yetkazib berasizmi?',
          a: "Yetkazib berish hududi kompaniya tomonidan belgilanadi va aloqa sahifasida ko'rsatiladi. Bu javob to'ldirilgunga qadar vaqtinchalik.",
        },
        zh: {
          q: '塔什干以外地区是否配送？',
          a: '配送范围由公司设定并在联系页面展示。此答案为占位内容，待填写。',
        },
      },
    },
    {
      slug: 'what-documentation-is-provided',
      serviceSlug: 'equipment-installation',
      content: {
        en: {
          q: 'What documentation is provided with equipment?',
          a: 'Documentation accompanying each product comes from its manufacturer and is attached to the product page in the resource section.',
        },
        ru: {
          q: 'Какая документация предоставляется с оборудованием?',
          a: 'Сопроводительная документация исходит от производителя и прикрепляется к странице продукта в разделе материалов.',
        },
        uz: {
          q: 'Uskuna bilan qanday hujjatlar beriladi?',
          a: "Har bir mahsulotning hamrohlik hujjatlari ishlab chiqaruvchidan keladi va mahsulot sahifasining materiallar bo'limiga biriktiriladi.",
        },
        zh: {
          q: '设备随附哪些文件？',
          a: '随附文件来自制造商，并在产品页的资料区提供下载。',
        },
      },
    },
  ]

  for (const [index, seed] of faqs.entries()) {
    const existing = await db.faq.findUnique({
      where: { slug: seed.slug },
      select: { id: true },
    })
    if (existing) continue

    await db.faq.create({
      data: {
        slug: seed.slug,
        status: 'PUBLISHED',
        sortOrder: index,
        serviceId: serviceIds.get(seed.serviceSlug) ?? null,
        translations: {
          create: translationRows({
            en: {
              question: seed.content.en.q,
              answer: richDoc([seed.content.en.a]) as object,
            },
            ru: {
              question: seed.content.ru.q,
              answer: richDoc([seed.content.ru.a]) as object,
            },
            uz: {
              question: seed.content.uz.q,
              answer: richDoc([seed.content.uz.a]) as object,
            },
            zh: {
              question: seed.content.zh.q,
              answer: richDoc([seed.content.zh.a]) as object,
            },
          }),
        },
      },
    })
  }
}

export async function seedOffices(): Promise<void> {
  const existing = await db.office.findUnique({
    where: { key: 'head-office' },
    select: { id: true },
  })
  if (existing) return

  await db.office.create({
    data: {
      key: 'head-office',
      countryCode: 'UZ',
      city: 'Tashkent',
      isHeadquarters: true,
      visible: true,
      sortOrder: 0,
      // Address, coordinates and hours are left empty on purpose — a made-up
      // address on a supplier's contact page is worse than a blank field.
      workingHours: [{ days: [1, 2, 3, 4, 5], open: '09:00', close: '18:00' }],
      translations: {
        create: translationRows({
          en: {
            name: 'Head office',
            addressLine: '',
            cityLocalized: 'Tashkent',
            note: '',
          },
          ru: {
            name: 'Главный офис',
            addressLine: '',
            cityLocalized: 'Ташкент',
            note: '',
          },
          uz: { name: 'Bosh ofis', addressLine: '', cityLocalized: 'Toshkent', note: '' },
          zh: { name: '总部', addressLine: '', cityLocalized: '塔什干', note: '' },
        }),
      },
    },
  })
}
