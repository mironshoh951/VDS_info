import { db } from '../../src/server/db/client'
import { translationRows, richDoc } from './helpers'
import type { Locale } from '../../src/i18n/config'

/**
 * Example products.
 *
 * ⚠ ALL OF THESE ARE FICTIONAL. The specifications are plausible in shape but
 * describe no real product, and nothing here is a medical or clinical claim.
 * They exist to exercise the catalogue: filters, specifications, relations,
 * documents and the detail template.
 */

interface SpecSeed {
  group: string
  label: string
  value: string
  unit?: string
  localized?: Partial<Record<Locale, { label?: string; value?: string }>>
}

interface ProductSeed {
  slug: string
  sku: string
  productCode: string
  brandSlug: string
  partnerSlug: string
  categorySlugs: string[]
  primaryCategorySlug: string
  countryOfOrigin: string
  unit: string
  packaging: string
  featured: boolean
  isNew: boolean
  attributes: Array<{ key: string; value?: string; bool?: boolean }>
  specs: SpecSeed[]
  content: Record<
    Locale,
    {
      name: string
      short: string
      benefits: string[]
      applications: string[]
      body: string[]
    }
  >
}

const products: ProductSeed[] = [
  {
    slug: 'norvenda-composite-nx',
    sku: 'NRV-CNX-A2',
    productCode: 'CNX-A2',
    brandSlug: 'norvenda',
    partnerSlug: 'norvenda-dental-systems',
    categorySlugs: ['restorative-dentistry', 'composites'],
    primaryCategorySlug: 'composites',
    countryOfOrigin: 'DE',
    unit: 'syringe',
    packaging: '4 g syringe',
    featured: true,
    isNew: true,
    attributes: [
      { key: 'treatment-area', value: 'anterior' },
      { key: 'treatment-area', value: 'posterior' },
      { key: 'technology', value: 'light-cure' },
    ],
    specs: [
      { group: 'physical', label: 'Filler load', value: '78', unit: '% by weight' },
      { group: 'physical', label: 'Particle size', value: '0.02 – 2.5', unit: 'µm' },
      { group: 'handling', label: 'Curing depth', value: '2.0', unit: 'mm' },
      { group: 'handling', label: 'Curing time', value: '20', unit: 's' },
      { group: 'handling', label: 'Working time', value: '90', unit: 's' },
      { group: 'storage', label: 'Storage temperature', value: '4 – 25', unit: '°C' },
      { group: 'storage', label: 'Shelf life', value: '36', unit: 'months' },
    ],
    content: {
      en: {
        name: 'Norvenda Composite NX',
        short:
          'Light-cured nano-hybrid composite for anterior and posterior restorations.',
        benefits: [
          'Sculptable consistency that holds its shape',
          'Shade range covering the common VITA classifications',
          'Radiopaque for straightforward follow-up imaging',
        ],
        applications: [
          'Class I to V direct restorations',
          'Veneer and diastema corrections',
          'Core build-ups',
        ],
        body: [
          'Example product record. A real entry would carry the manufacturer’s technical data, instructions for use, safety documentation and certification files, all uploaded through the media library and linked here.',
        ],
      },
      ru: {
        name: 'Norvenda Composite NX',
        short:
          'Наногибридный композит светового отверждения для фронтальных и жевательных реставраций.',
        benefits: [
          'Моделируемая консистенция, хорошо держит форму',
          'Оттеночная линейка по распространённой шкале VITA',
          'Рентгеноконтрастность для контроля на снимках',
        ],
        applications: [
          'Прямые реставрации классов I–V',
          'Виниры и коррекция диастем',
          'Восстановление культи зуба',
        ],
        body: [
          'Пример карточки продукта. В реальной записи были бы технические данные производителя, инструкция по применению, документы по безопасности и сертификаты, загруженные через медиабиблиотеку.',
        ],
      },
      uz: {
        name: 'Norvenda Composite NX',
        short:
          "Old va orqa tishlar restavratsiyasi uchun yorug'likda qotadigan nanogibrid kompozit.",
        benefits: [
          'Modellash uchun qulay, shaklini yaxshi saqlaydigan konsistensiya',
          'Keng tarqalgan VITA shkalasi bo’yicha ranglar qatori',
          'Rentgenkontrast — nazorat suratlarida yaxshi ko’rinadi',
        ],
        applications: [
          "I–V sinf to'g'ridan-to'g'ri restavratsiyalar",
          'Vinir va diastema korreksiyasi',
          'Tish kultisini tiklash',
        ],
        body: [
          "Namunaviy mahsulot yozuvi. Haqiqiy yozuvda ishlab chiqaruvchining texnik ma'lumotlari, qo'llash yo'riqnomasi, xavfsizlik hujjatlari va sertifikatlar media kutubxona orqali yuklanadi.",
        ],
      },
      zh: {
        name: 'Norvenda Composite NX',
        short: '光固化纳米混合型复合树脂，适用于前牙与后牙修复。',
        benefits: [
          '雕塑性好，成形稳定',
          '色号覆盖常用 VITA 比色系统',
          '具阻射性，便于影像复查',
        ],
        applications: ['I–V 类直接修复', '贴面与间隙关闭', '核堆积'],
        body: [
          '产品记录示例。真实条目会包含制造商技术数据、使用说明、安全文件与资质证书，均通过媒体库上传并在此关联。',
        ],
      },
    },
  },
  {
    slug: 'norvenda-bond-universal',
    sku: 'NRV-BU-5',
    productCode: 'BU-5',
    brandSlug: 'norvenda',
    partnerSlug: 'norvenda-dental-systems',
    categorySlugs: ['restorative-dentistry', 'adhesives-and-bonding'],
    primaryCategorySlug: 'adhesives-and-bonding',
    countryOfOrigin: 'DE',
    unit: 'bottle',
    packaging: '5 ml bottle',
    featured: true,
    isNew: false,
    attributes: [{ key: 'technology', value: 'light-cure' }],
    specs: [
      { group: 'physical', label: 'pH', value: '2.6' },
      { group: 'handling', label: 'Application time', value: '20', unit: 's' },
      { group: 'handling', label: 'Curing time', value: '10', unit: 's' },
      { group: 'handling', label: 'Film thickness', value: '8', unit: 'µm' },
      { group: 'storage', label: 'Shelf life', value: '24', unit: 'months' },
    ],
    content: {
      en: {
        name: 'Norvenda Bond Universal',
        short: 'Single-bottle universal adhesive compatible with all etching protocols.',
        benefits: [
          'One bottle for total-etch, selective-etch and self-etch',
          'Low film thickness',
        ],
        applications: [
          'Direct and indirect restorations',
          'Repairs of existing restorations',
        ],
        body: ['Example product record.'],
      },
      ru: {
        name: 'Norvenda Bond Universal',
        short:
          'Универсальный однокомпонентный адгезив, совместимый со всеми протоколами травления.',
        benefits: [
          'Один флакон для тотального, селективного и самопротравливания',
          'Малая толщина плёнки',
        ],
        applications: [
          'Прямые и непрямые реставрации',
          'Починка существующих реставраций',
        ],
        body: ['Пример карточки продукта.'],
      },
      uz: {
        name: 'Norvenda Bond Universal',
        short: "Barcha o'yish protokollariga mos bir komponentli universal adgeziv.",
        benefits: [
          "Total, selektiv va o'z-o'zidan o'yish uchun bitta flakon",
          'Yupqa plyonka qalinligi',
        ],
        applications: [
          "To'g'ridan-to'g'ri va bilvosita restavratsiyalar",
          'Mavjud restavratsiyalarni ta’mirlash',
        ],
        body: ['Namunaviy mahsulot yozuvi.'],
      },
      zh: {
        name: 'Norvenda Bond Universal',
        short: '单瓶通用型粘接剂，兼容各种酸蚀方案。',
        benefits: ['一瓶适用于全酸蚀、选择性酸蚀与自酸蚀', '膜厚低'],
        applications: ['直接与间接修复', '旧修复体修补'],
        body: ['产品记录示例。'],
      },
    },
  },
  {
    slug: 'endoline-rotary-file-set',
    sku: 'EDL-RF-SET25',
    productCode: 'RF-SET25',
    brandSlug: 'endoline',
    partnerSlug: 'hanwoo-dental-tech',
    categorySlugs: ['endodontics', 'rotary-files'],
    primaryCategorySlug: 'rotary-files',
    countryOfOrigin: 'KR',
    unit: 'set',
    packaging: 'Set of 6 files, 25 mm',
    featured: true,
    isNew: true,
    attributes: [
      { key: 'treatment-area', value: 'root-canal' },
      { key: 'sterilizable', bool: true },
    ],
    specs: [
      { group: 'physical', label: 'Alloy', value: 'Heat-treated nickel-titanium' },
      { group: 'physical', label: 'Length', value: '25', unit: 'mm' },
      { group: 'physical', label: 'Taper range', value: '.04 – .06' },
      { group: 'handling', label: 'Recommended speed', value: '300 – 500', unit: 'rpm' },
      { group: 'handling', label: 'Recommended torque', value: '2.0 – 2.5', unit: 'Ncm' },
      { group: 'processing', label: 'Sterilization', value: '134 °C autoclave' },
    ],
    content: {
      en: {
        name: 'Endoline Rotary File Set',
        short: 'Heat-treated nickel-titanium rotary file set for canal shaping.',
        benefits: ['Flexible in curved canals', 'Autoclavable'],
        applications: [
          'Root canal shaping',
          'Retreatment when used with the matching sequence',
        ],
        body: ['Example product record.'],
      },
      ru: {
        name: 'Endoline Rotary File Set',
        short:
          'Набор машинных никель-титановых файлов с термообработкой для формирования каналов.',
        benefits: ['Гибкость в изогнутых каналах', 'Автоклавируемые'],
        applications: [
          'Формирование корневых каналов',
          'Перелечивание в соответствующей последовательности',
        ],
        body: ['Пример карточки продукта.'],
      },
      uz: {
        name: 'Endoline Rotary File Set',
        short:
          'Kanallarni shakllantirish uchun termik ishlov berilgan nikel-titan fayllar to’plami.',
        benefits: ['Egri kanallarda egiluvchan', 'Avtoklavlanadi'],
        applications: [
          'Ildiz kanallarini shakllantirish',
          'Mos ketma-ketlikda qayta davolash',
        ],
        body: ['Namunaviy mahsulot yozuvi.'],
      },
      zh: {
        name: 'Endoline Rotary File Set',
        short: '热处理镍钛机用锉套装，用于根管预备。',
        benefits: ['弯曲根管中柔韧性好', '可高压灭菌'],
        applications: ['根管预备', '按配套序列用于再治疗'],
        body: ['产品记录示例。'],
      },
    },
  },
  {
    slug: 'endoline-sealer-mta',
    sku: 'EDL-SMTA-2',
    productCode: 'SMTA-2',
    brandSlug: 'endoline',
    partnerSlug: 'hanwoo-dental-tech',
    categorySlugs: ['endodontics', 'obturation'],
    primaryCategorySlug: 'obturation',
    countryOfOrigin: 'KR',
    unit: 'syringe',
    packaging: '2 g pre-mixed syringe',
    featured: false,
    isNew: false,
    attributes: [{ key: 'treatment-area', value: 'root-canal' }],
    specs: [
      { group: 'physical', label: 'Base', value: 'Calcium silicate' },
      { group: 'handling', label: 'Setting time', value: '120 – 240', unit: 'min' },
      { group: 'handling', label: 'Flow', value: '≥ 20', unit: 'mm' },
      { group: 'physical', label: 'Radiopacity', value: '≥ 7', unit: 'mm Al' },
    ],
    content: {
      en: {
        name: 'Endoline Sealer MTA',
        short: 'Pre-mixed calcium silicate root canal sealer.',
        benefits: ['Ready to use, no mixing', 'Radiopaque'],
        applications: ['Root canal obturation with single-cone or lateral condensation'],
        body: ['Example product record.'],
      },
      ru: {
        name: 'Endoline Sealer MTA',
        short: 'Готовый к применению силер на основе силиката кальция.',
        benefits: ['Готов к использованию, без замешивания', 'Рентгеноконтрастный'],
        applications: [
          'Обтурация каналов методом одного штифта или латеральной конденсации',
        ],
        body: ['Пример карточки продукта.'],
      },
      uz: {
        name: 'Endoline Sealer MTA',
        short: 'Kalsiy silikat asosidagi tayyor siler.',
        benefits: ['Aralashtirishsiz, tayyor holda', 'Rentgenkontrast'],
        applications: [
          'Bitta shtift yoki lateral kondensatsiya usulida kanal obturatsiyasi',
        ],
        body: ['Namunaviy mahsulot yozuvi.'],
      },
      zh: {
        name: 'Endoline Sealer MTA',
        short: '预混硅酸钙根管封闭剂。',
        benefits: ['即开即用，无需调拌', '具阻射性'],
        applications: ['单尖法或侧方加压根管充填'],
        body: ['产品记录示例。'],
      },
    },
  },
  {
    slug: 'clarion-a-silicone-putty',
    sku: 'CLR-ASP-900',
    productCode: 'ASP-900',
    brandSlug: 'clarion',
    partnerSlug: 'aurelio-medical-supplies',
    categorySlugs: ['prosthodontics', 'impression-materials'],
    primaryCategorySlug: 'impression-materials',
    countryOfOrigin: 'IT',
    unit: 'kit',
    packaging: '2 × 450 ml jars',
    featured: true,
    isNew: false,
    attributes: [{ key: 'technology', value: 'self-cure' }],
    specs: [
      { group: 'physical', label: 'Type', value: 'Addition-cured silicone, putty' },
      { group: 'handling', label: 'Working time', value: '60', unit: 's' },
      { group: 'handling', label: 'Setting time in mouth', value: '180', unit: 's' },
      { group: 'physical', label: 'Shore A hardness', value: '62' },
      {
        group: 'physical',
        label: 'Linear dimensional change',
        value: '< 0.2',
        unit: '%',
      },
    ],
    content: {
      en: {
        name: 'Clarion A-Silicone Putty',
        short: 'Addition-cured silicone putty for two-stage impressions.',
        benefits: ['Dimensionally stable', 'Clean handling'],
        applications: [
          'Crown and bridge impressions',
          'Matrices for temporary restorations',
        ],
        body: ['Example product record.'],
      },
      ru: {
        name: 'Clarion A-Silicone Putty',
        short: 'А-силикон типа «путти» для двухэтапного оттиска.',
        benefits: ['Стабильность размеров', 'Не липнет к перчаткам'],
        applications: ['Оттиски под коронки и мосты', 'Ключи для временных реставраций'],
        body: ['Пример карточки продукта.'],
      },
      uz: {
        name: 'Clarion A-Silicone Putty',
        short: 'Ikki bosqichli ottisk uchun A-silikon «putti».',
        benefits: ["O'lchamlari barqaror", 'Qo’lqopga yopishmaydi'],
        applications: [
          'Toj va ko’prik ostiga ottisklar',
          'Vaqtinchalik restavratsiya uchun kalitlar',
        ],
        body: ['Namunaviy mahsulot yozuvi.'],
      },
      zh: {
        name: 'Clarion A-Silicone Putty',
        short: '加成型硅橡胶重体，适用于两步法印模。',
        benefits: ['尺寸稳定性好', '操作不粘手'],
        applications: ['冠桥印模', '临时修复导板'],
        body: ['产品记录示例。'],
      },
    },
  },
  {
    slug: 'clarion-alginate-fast',
    sku: 'CLR-ALG-450',
    productCode: 'ALG-450',
    brandSlug: 'clarion',
    partnerSlug: 'aurelio-medical-supplies',
    categorySlugs: ['prosthodontics', 'impression-materials', 'consumables'],
    primaryCategorySlug: 'impression-materials',
    countryOfOrigin: 'IT',
    unit: 'bag',
    packaging: '450 g bag',
    featured: false,
    isNew: false,
    attributes: [{ key: 'technology', value: 'self-cure' }],
    specs: [
      { group: 'handling', label: 'Mixing time', value: '30', unit: 's' },
      { group: 'handling', label: 'Setting time', value: '90', unit: 's' },
      { group: 'physical', label: 'Type', value: 'Fast-set alginate' },
    ],
    content: {
      en: {
        name: 'Clarion Alginate Fast',
        short: 'Fast-setting alginate impression material.',
        benefits: ['Short chair time', 'Dust-reduced formulation'],
        applications: ['Study models', 'Orthodontic impressions'],
        body: ['Example product record.'],
      },
      ru: {
        name: 'Clarion Alginate Fast',
        short: 'Быстротвердеющий альгинатный оттискный материал.',
        benefits: ['Сокращает время в кресле', 'Формула с пониженным пылеобразованием'],
        applications: ['Диагностические модели', 'Ортодонтические оттиски'],
        body: ['Пример карточки продукта.'],
      },
      uz: {
        name: 'Clarion Alginate Fast',
        short: 'Tez qotadigan alginat ottisk materiali.',
        benefits: ['Kreslodagi vaqtni qisqartiradi', 'Chang kam chiqadigan formula'],
        applications: ['Diagnostik modellar', 'Ortodontik ottisklar'],
        body: ['Namunaviy mahsulot yozuvi.'],
      },
      zh: {
        name: 'Clarion Alginate Fast',
        short: '快凝型藻酸盐印模材料。',
        benefits: ['缩短椅旁时间', '低粉尘配方'],
        applications: ['研究模型', '正畸印模'],
        body: ['产品记录示例。'],
      },
    },
  },
  {
    slug: 'steriqo-surface-wipes',
    sku: 'STQ-SW-100',
    productCode: 'SW-100',
    brandSlug: 'steriqo',
    partnerSlug: 'aurelio-medical-supplies',
    categorySlugs: ['infection-control', 'consumables'],
    primaryCategorySlug: 'infection-control',
    countryOfOrigin: 'IT',
    unit: 'tub',
    packaging: 'Tub of 100 wipes',
    featured: false,
    isNew: false,
    attributes: [],
    specs: [
      { group: 'physical', label: 'Wipe size', value: '20 × 20', unit: 'cm' },
      { group: 'physical', label: 'Wipes per tub', value: '100' },
      { group: 'storage', label: 'Shelf life', value: '24', unit: 'months' },
    ],
    content: {
      en: {
        name: 'Steriqo Surface Wipes',
        short: 'Pre-moistened wipes for cleaning dental surfaces and equipment.',
        benefits: [
          'Alcohol-free formulation',
          'Material-compatible with common surfaces',
        ],
        applications: ['Surface cleaning between patients', 'Equipment housings'],
        body: [
          'Example product record. Disinfection claims and approvals are regulatory matters and are never generated by this platform — they come from the manufacturer’s own documentation.',
        ],
      },
      ru: {
        name: 'Steriqo Surface Wipes',
        short: 'Готовые влажные салфетки для очистки поверхностей и оборудования.',
        benefits: ['Состав без спирта', 'Совместимы с распространёнными поверхностями'],
        applications: ['Очистка поверхностей между пациентами', 'Корпуса оборудования'],
        body: [
          'Пример карточки продукта. Заявления о дезинфекции и регистрационные сведения — регуляторный вопрос; платформа их не генерирует, они берутся из документации производителя.',
        ],
      },
      uz: {
        name: 'Steriqo Surface Wipes',
        short: 'Yuza va uskunalarni tozalash uchun tayyor nam salfetkalar.',
        benefits: ['Spirtsiz tarkib', 'Keng tarqalgan yuzalarga mos'],
        applications: ['Bemorlar orasida yuzalarni tozalash', 'Uskuna korpuslari'],
        body: [
          "Namunaviy mahsulot yozuvi. Dezinfeksiya bo'yicha da'volar va ro'yxatdan o'tish ma'lumotlari — tartibga solish masalasi; platforma ularni o'zi yaratmaydi, ishlab chiqaruvchi hujjatlaridan olinadi.",
        ],
      },
      zh: {
        name: 'Steriqo Surface Wipes',
        short: '预湿消毒湿巾，用于清洁牙科表面与设备。',
        benefits: ['无酒精配方', '与常见表面材料相容'],
        applications: ['患者间表面清洁', '设备外壳'],
        body: [
          '产品记录示例。消毒功效声明与注册信息属于监管事项，本平台不会自行生成，均来自制造商文件。',
        ],
      },
    },
  },
  {
    slug: 'norvenda-curing-light-pro',
    sku: 'NRV-CLP-1',
    productCode: 'CLP-1',
    brandSlug: 'norvenda',
    partnerSlug: 'norvenda-dental-systems',
    categorySlugs: ['dental-equipment', 'restorative-dentistry'],
    primaryCategorySlug: 'dental-equipment',
    countryOfOrigin: 'DE',
    unit: 'unit',
    packaging: 'Handpiece, charger, light shield',
    featured: true,
    isNew: false,
    attributes: [{ key: 'sterilizable', bool: false }],
    specs: [
      { group: 'optical', label: 'Wavelength', value: '385 – 515', unit: 'nm' },
      { group: 'optical', label: 'Light intensity', value: '1200', unit: 'mW/cm²' },
      { group: 'power', label: 'Battery life', value: '≈ 600', unit: 'cycles' },
      { group: 'power', label: 'Charging time', value: '2', unit: 'h' },
      { group: 'physical', label: 'Weight', value: '180', unit: 'g' },
    ],
    content: {
      en: {
        name: 'Norvenda Curing Light Pro',
        short: 'Cordless LED curing light with a broad wavelength range.',
        benefits: ['Broad spectrum covers common photoinitiators', 'Cordless operation'],
        applications: ['Polymerisation of light-cured restorative materials'],
        body: [
          'Example product record showing an equipment entry rather than a material.',
        ],
      },
      ru: {
        name: 'Norvenda Curing Light Pro',
        short: 'Беспроводная светодиодная лампа с широким диапазоном длин волн.',
        benefits: [
          'Широкий спектр перекрывает распространённые фотоинициаторы',
          'Работа без провода',
        ],
        applications: ['Полимеризация материалов светового отверждения'],
        body: ['Пример карточки оборудования, а не материала.'],
      },
      uz: {
        name: 'Norvenda Curing Light Pro',
        short: "Keng to'lqin diapazoniga ega simsiz LED lampa.",
        benefits: [
          'Keng spektr keng tarqalgan fotoinitsiatorlarni qamrab oladi',
          'Simsiz ishlaydi',
        ],
        applications: ["Yorug'likda qotadigan materiallarni polimerizatsiya qilish"],
        body: ['Material emas, uskuna yozuvining namunasi.'],
      },
      zh: {
        name: 'Norvenda Curing Light Pro',
        short: '无线 LED 光固化灯，波长范围宽。',
        benefits: ['宽光谱覆盖常见光引发剂', '无线操作'],
        applications: ['光固化修复材料的聚合'],
        body: ['设备类条目示例，区别于材料类条目。'],
      },
    },
  },
]

/** Editorial cross-links, so "related products" is real data rather than a guess. */
const relations: Array<{ source: string; target: string; kind: string }> = [
  {
    source: 'norvenda-composite-nx',
    target: 'norvenda-bond-universal',
    kind: 'consumable',
  },
  {
    source: 'norvenda-composite-nx',
    target: 'norvenda-curing-light-pro',
    kind: 'accessory',
  },
  { source: 'norvenda-bond-universal', target: 'norvenda-composite-nx', kind: 'related' },
  { source: 'endoline-rotary-file-set', target: 'endoline-sealer-mta', kind: 'related' },
  {
    source: 'clarion-a-silicone-putty',
    target: 'clarion-alginate-fast',
    kind: 'alternative',
  },
]

export async function seedProducts(
  partnerIds: Map<string, string>,
  brandIds: Map<string, string>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>()

  const categories = await db.productCategory.findMany({
    select: { id: true, slug: true },
  })
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]))

  const attributes = await db.productAttribute.findMany({
    select: { id: true, key: true },
  })
  const attributeByKey = new Map(attributes.map((a) => [a.key, a.id]))

  for (const [index, seed] of products.entries()) {
    const existing = await db.product.findUnique({
      where: { slug: seed.slug },
      select: { id: true },
    })

    if (existing) {
      ids.set(seed.slug, existing.id)
      continue
    }

    const product = await db.product.create({
      data: {
        slug: seed.slug,
        sku: seed.sku,
        productCode: seed.productCode,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        brandId: brandIds.get(seed.brandSlug) ?? null,
        partnerId: partnerIds.get(seed.partnerSlug) ?? null,
        countryOfOrigin: seed.countryOfOrigin,
        unit: seed.unit,
        packaging: seed.packaging,
        featured: seed.featured,
        isNew: seed.isNew,
        sortOrder: index,
        categories: {
          create: seed.categorySlugs
            .map((slug) => ({ slug, id: categoryBySlug.get(slug) }))
            .filter((entry): entry is { slug: string; id: string } => Boolean(entry.id))
            .map((entry) => ({
              categoryId: entry.id,
              isPrimary: entry.slug === seed.primaryCategorySlug,
            })),
        },
        specifications: {
          create: seed.specs.map((spec, order) => ({
            groupKey: spec.group,
            labelKey: spec.label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            label: spec.label,
            value: spec.value,
            unit: spec.unit ?? null,
            sortOrder: order,
            localized: (spec.localized ?? undefined) as object | undefined,
          })),
        },
        attributeValues: {
          create: seed.attributes
            .map((attribute) => ({
              attributeId: attributeByKey.get(attribute.key),
              valueString: attribute.value ?? null,
              valueBool: attribute.bool ?? null,
            }))
            .filter(
              (
                entry,
              ): entry is {
                attributeId: string
                valueString: string | null
                valueBool: boolean | null
              } => Boolean(entry.attributeId),
            ),
        },
        translations: {
          create: translationRows({
            en: {
              slug: seed.slug,
              name: seed.content.en.name,
              shortDescription: seed.content.en.short,
              description: richDoc(seed.content.en.body) as object,
              benefits: seed.content.en.benefits,
              applications: seed.content.en.applications,
              indications: [],
            },
            ru: {
              slug: null,
              name: seed.content.ru.name,
              shortDescription: seed.content.ru.short,
              description: richDoc(seed.content.ru.body) as object,
              benefits: seed.content.ru.benefits,
              applications: seed.content.ru.applications,
              indications: [],
            },
            uz: {
              slug: null,
              name: seed.content.uz.name,
              shortDescription: seed.content.uz.short,
              description: richDoc(seed.content.uz.body) as object,
              benefits: seed.content.uz.benefits,
              applications: seed.content.uz.applications,
              indications: [],
            },
            zh: {
              slug: null,
              name: seed.content.zh.name,
              shortDescription: seed.content.zh.short,
              description: richDoc(seed.content.zh.body) as object,
              benefits: seed.content.zh.benefits,
              applications: seed.content.zh.applications,
              indications: [],
            },
          }),
        },
      },
      select: { id: true },
    })

    ids.set(seed.slug, product.id)
  }

  for (const [order, relation] of relations.entries()) {
    const sourceId = ids.get(relation.source)
    const targetId = ids.get(relation.target)
    if (!sourceId || !targetId) continue

    await db.productRelation.upsert({
      where: {
        sourceId_targetId_kind: { sourceId, targetId, kind: relation.kind },
      },
      create: { sourceId, targetId, kind: relation.kind, sortOrder: order },
      update: {},
    })
  }

  return ids
}
