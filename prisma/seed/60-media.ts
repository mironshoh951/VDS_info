import path from 'node:path'
import fs from 'node:fs/promises'
import sharp from 'sharp'
import { db } from '../../src/server/db/client'
import { mediaStorage, newStorageKey } from '../../src/server/media/storage'
import { LOCALES } from '../../src/i18n/config'
import { monogramSvg, productSvg, sceneSvg } from './media-art'

/**
 * Images for the development seed.
 *
 * Product, brand and partner placeholders are generated (see media-art.ts)
 * rather than downloaded, so the seed carries no third-party licence and no
 * photograph of a product this fictional catalogue does not actually stock.
 *
 * The home page's hero and "inside the company" gallery are the exception:
 * those are real photographs of dental clinics and equipment, sourced from
 * Wikimedia Commons under CC BY / CC BY-SA licences that permit reuse with
 * attribution. They are generic — no image claims to be *this* company's own
 * premises, only "a modern dental clinic" or "dental equipment" — which is
 * why the caption on every one names its real subject rather than inventing a
 * department. Full source, author and licence are recorded in
 * `prisma/seed/assets/real-photos/CREDITS.md`.
 *
 * Idempotent like every other step: an asset is recognised by the seed key
 * stored in `originalName`, so re-running attaches the same images instead of
 * filling the library with duplicates.
 */

const VARIANTS = [
  { label: 'thumb', width: 320 },
  { label: 'medium', width: 1024 },
] as const

const REAL_PHOTOS_DIR = path.join(__dirname, 'assets', 'real-photos')

/** Marks an asset as seed-generated and makes it findable on a re-run. */
function seedName(key: string): string {
  return `seed-${key}.png`
}

/** Marks a real-photo asset the same way, without pretending it is a PNG. */
function seedRealName(key: string): string {
  return `seed-real-${key}.jpg`
}

type Art = 'product' | 'monogram' | 'scene'

function render(art: Art, key: string, label: string): string {
  if (art === 'monogram') return monogramSvg(key, label)
  if (art === 'product') return productSvg(key, label)
  return sceneSvg(key)
}

/**
 * Creates one asset, or returns the existing one.
 *
 * Mirrors what `uploadMedia` does — original plus derived sizes, dominant
 * colour, alt text per locale — without going through it, because that path
 * requires an actor and a capability check that a seed script has no business
 * pretending to satisfy.
 */
async function ensureAsset(input: {
  key: string
  art: Art
  label: string
  alt: Record<string, string>
}): Promise<string> {
  const originalName = seedName(input.key)

  const existing = await db.mediaAsset.findFirst({
    where: { originalName, deletedAt: null },
    select: { id: true },
  })
  if (existing) return existing.id

  const svg = render(input.art, input.key, input.label)
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()

  const storage = mediaStorage()
  const storageKey = newStorageKey('image/png')
  await storage.put(storageKey, png, 'image/png')

  const image = sharp(png)
  const metadata = await image.metadata()
  const stats = await image.stats()
  const { r, g, b } = stats.dominant
  const dominantColor = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`

  const variants: {
    label: string
    format: string
    width: number
    height: number
    sizeBytes: number
    storageKey: string
  }[] = []

  for (const variant of VARIANTS) {
    // Never upscale, for the same reason the upload path does not: a bigger
    // file that looks worse is not a useful derivative.
    if ((metadata.width ?? 0) <= variant.width) continue
    const buffer = await sharp(png)
      .resize({ width: variant.width, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true })
    const key = newStorageKey('image/webp', variant.label)
    await storage.put(key, buffer.data, 'image/webp')
    variants.push({
      label: variant.label,
      format: 'webp',
      width: buffer.info.width,
      height: buffer.info.height,
      sizeBytes: buffer.info.size,
      storageKey: key,
    })
  }

  const asset = await db.mediaAsset.create({
    data: {
      kind: 'IMAGE',
      status: 'READY',
      visibility: 'PUBLIC',
      storageKey,
      originalName,
      mimeType: 'image/png',
      sizeBytes: png.byteLength,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      dominantColor,
      variants: variants.length > 0 ? { create: variants } : undefined,
      translations: {
        create: LOCALES.map((locale) => ({
          locale,
          alt: input.alt[locale] ?? input.alt.en ?? '',
          status: 'APPROVED' as const,
          origin: 'IMPORT' as const,
        })),
      },
    },
    select: { id: true },
  })

  return asset.id
}

/**
 * Creates one asset from a real JPEG on disk, or returns the existing one.
 *
 * Same shape as `ensureAsset`, minus the rendering step: the original file
 * *is* the source image, so it is uploaded as-is and only the derived sizes
 * are generated. `caption` carries the photo credit in every locale, which is
 * where the gallery block and any future "photo info" affordance will read it
 * from — the attribution travels with the asset rather than living only in a
 * markdown file no visitor will ever see.
 */
async function ensureRealAsset(input: {
  key: string
  file: string
  alt: Record<string, string>
  credit: Record<string, string>
}): Promise<string> {
  const originalName = seedRealName(input.key)

  const existing = await db.mediaAsset.findFirst({
    where: { originalName, deletedAt: null },
    select: { id: true },
  })
  if (existing) return existing.id

  const jpeg = await fs.readFile(path.join(REAL_PHOTOS_DIR, input.file))

  const storage = mediaStorage()
  const storageKey = newStorageKey('image/jpeg')
  await storage.put(storageKey, jpeg, 'image/jpeg')

  const image = sharp(jpeg)
  const metadata = await image.metadata()
  const stats = await image.stats()
  const { r, g, b } = stats.dominant
  const dominantColor = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`

  const variants: {
    label: string
    format: string
    width: number
    height: number
    sizeBytes: number
    storageKey: string
  }[] = []

  for (const variant of VARIANTS) {
    if ((metadata.width ?? 0) <= variant.width) continue
    const buffer = await sharp(jpeg)
      .resize({ width: variant.width, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true })
    const key = newStorageKey('image/webp', variant.label)
    await storage.put(key, buffer.data, 'image/webp')
    variants.push({
      label: variant.label,
      format: 'webp',
      width: buffer.info.width,
      height: buffer.info.height,
      sizeBytes: buffer.info.size,
      storageKey: key,
    })
  }

  const asset = await db.mediaAsset.create({
    data: {
      kind: 'IMAGE',
      status: 'READY',
      visibility: 'PUBLIC',
      storageKey,
      originalName,
      mimeType: 'image/jpeg',
      sizeBytes: jpeg.byteLength,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      dominantColor,
      variants: variants.length > 0 ? { create: variants } : undefined,
      translations: {
        create: LOCALES.map((locale) => ({
          locale,
          alt: input.alt[locale] ?? input.alt.en ?? '',
          caption: input.credit[locale] ?? input.credit.en ?? '',
          status: 'APPROVED' as const,
          origin: 'IMPORT' as const,
        })),
      },
    },
    select: { id: true },
  })

  return asset.id
}

function altFor(label: string): Record<string, string> {
  return {
    en: `Placeholder artwork for ${label}`,
    ru: `Заглушка для «${label}»`,
    uz: `${label} uchun vaqtinchalik tasvir`,
    zh: `${label} 的占位图`,
  }
}

/** A real photo's four-language description and its four-language credit line. */
interface RealPhoto {
  key: string
  file: string
  alt: Record<string, string>
  credit: Record<string, string>
}

function credit(author: string, license: string): Record<string, string> {
  return {
    en: `Photo: ${author} / Wikimedia Commons, ${license}`,
    ru: `Фото: ${author} / Wikimedia Commons, ${license}`,
    uz: `Surat: ${author} / Wikimedia Commons, ${license}`,
    zh: `图片：${author} / 维基共享资源，${license}`,
  }
}

const HERO_PHOTO: RealPhoto = {
  key: 'hero-home',
  file: 'vds-hero-clinic.jpg',
  alt: {
    en: 'A modern dental treatment room with equipment and a chair',
    ru: 'Современный стоматологический кабинет с оборудованием и креслом',
    uz: 'Zamonaviy stomatologik davolash xonasi, uskuna va kreslo bilan',
    zh: '配备设备和牙椅的现代化牙科诊室',
  },
  credit: credit('Shixart1985', 'CC BY 2.0'),
}

const GALLERY_PHOTOS: RealPhoto[] = [
  {
    key: 'gallery-tools',
    file: 'vds-gallery-tools.jpg',
    alt: {
      en: 'Dental tools and equipment arranged on a clinical workstation',
      ru: 'Стоматологические инструменты на рабочем месте',
      uz: 'Klinik ish stolida tartibli joylashgan stomatologik asboblar',
      zh: '整齐摆放在诊疗台上的牙科器械',
    },
    credit: credit('Shixart1985', 'CC BY 2.0'),
  },
  {
    key: 'gallery-professional',
    file: 'vds-gallery-professional.jpg',
    alt: {
      en: 'A dental professional in protective gear preparing equipment',
      ru: 'Стоматолог в защитной экипировке готовит оборудование',
      uz: 'Himoya kiyimidagi stomatolog uskunani tayyorlamoqda',
      zh: '身穿防护装备的牙科医生正在准备设备',
    },
    credit: credit('Shixart1985', 'CC BY 2.0'),
  },
  {
    key: 'gallery-office',
    file: 'vds-gallery-office.jpg',
    alt: {
      en: 'A dental office with treatment equipment',
      ru: 'Стоматологический кабинет с лечебным оборудованием',
      uz: 'Davolash uskunalari bilan jihozlangan stomatologiya kabineti',
      zh: '配有诊疗设备的牙科诊所',
    },
    credit: credit('Nenad Stojkovic', 'CC BY 2.0'),
  },
  {
    key: 'gallery-clinic',
    file: 'vds-gallery-aoude.jpg',
    alt: {
      en: 'A modern dental clinic interior',
      ru: 'Интерьер современной стоматологической клиники',
      uz: 'Zamonaviy stomatologiya klinikasining ichki ko’rinishi',
      zh: '现代牙科诊所内部',
    },
    credit: credit('Jeangagnon', 'CC BY-SA 4.0'),
  },
  {
    key: 'gallery-unit',
    file: 'vds-gallery-unit.jpg',
    alt: {
      en: 'A modern dental treatment unit',
      ru: 'Современная стоматологическая установка',
      uz: 'Zamonaviy stomatologik qurilma',
      zh: '现代牙科治疗设备',
    },
    credit: credit('Gnatus Equipamentos Médico-Odontológicos', 'CC BY-SA 4.0'),
  },
  {
    key: 'gallery-zabrze',
    file: 'vds-gallery-zabrze.jpg',
    alt: {
      en: "A dentist's treatment room",
      ru: 'Стоматологический лечебный кабинет',
      uz: 'Stomatolog davolash xonasi',
      zh: '牙科诊疗室',
    },
    credit: credit('MichalPL', 'CC BY-SA 4.0'),
  },
]

export async function seedMedia(): Promise<void> {
  // --- Products: one primary image each --------------------------------------
  const products = await db.product.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, media: { select: { id: true } } },
  })

  for (const product of products) {
    if (product.media.length > 0) continue
    const assetId = await ensureAsset({
      key: `product-${product.slug}`,
      art: 'product',
      label: product.slug.replace(/-/g, ' '),
      alt: altFor(product.slug.replace(/-/g, ' ')),
    })
    await db.productMedia.create({
      data: { productId: product.id, assetId, role: 'primary', sortOrder: 0 },
    })
  }

  // --- Brands: a monogram ------------------------------------------------------
  const brands = await db.brand.findMany({
    where: { deletedAt: null, logoId: null },
    select: { id: true, slug: true, name: true },
  })
  for (const brand of brands) {
    const logoId = await ensureAsset({
      key: `brand-${brand.slug}`,
      art: 'monogram',
      label: brand.name,
      alt: altFor(brand.name),
    })
    await db.brand.update({ where: { id: brand.id }, data: { logoId } })
  }

  // --- Partners: a monogram and a cover ---------------------------------------
  const partners = await db.partner.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, legalName: true, logoId: true, coverId: true },
  })
  for (const partner of partners) {
    const label = partner.legalName ?? partner.slug
    const data: { logoId?: string; coverId?: string } = {}
    if (!partner.logoId) {
      data.logoId = await ensureAsset({
        key: `partner-${partner.slug}`,
        art: 'monogram',
        label,
        alt: altFor(label),
      })
    }
    if (!partner.coverId) {
      data.coverId = await ensureAsset({
        key: `partner-cover-${partner.slug}`,
        art: 'scene',
        label,
        alt: altFor(label),
      })
    }
    if (Object.keys(data).length > 0) {
      await db.partner.update({ where: { id: partner.id }, data })
    }
  }

  // --- Editorial covers --------------------------------------------------------
  const articles = await db.article.findMany({
    where: { deletedAt: null, coverId: null },
    select: { id: true, slug: true },
  })
  for (const article of articles) {
    const coverId = await ensureAsset({
      key: `article-${article.slug}`,
      art: 'scene',
      label: article.slug,
      alt: altFor(article.slug.replace(/-/g, ' ')),
    })
    await db.article.update({ where: { id: article.id }, data: { coverId } })
  }

  const events = await db.event.findMany({
    where: { deletedAt: null, coverId: null },
    select: { id: true, slug: true },
  })
  for (const event of events) {
    const coverId = await ensureAsset({
      key: `event-${event.slug}`,
      art: 'scene',
      label: event.slug,
      alt: altFor(event.slug.replace(/-/g, ' ')),
    })
    await db.event.update({ where: { id: event.id }, data: { coverId } })
  }

  const services = await db.service.findMany({
    where: { deletedAt: null, coverId: null },
    select: { id: true, slug: true },
  })
  for (const service of services) {
    const coverId = await ensureAsset({
      key: `service-${service.slug}`,
      art: 'scene',
      label: service.slug,
      alt: altFor(service.slug.replace(/-/g, ' ')),
    })
    await db.service.update({ where: { id: service.id }, data: { coverId } })
  }

  // --- The home page: a hero picture and a gallery of real company-style photos
  const home = await db.page.findFirst({
    where: { systemKey: 'home' },
    select: { id: true, blocks: { select: { id: true, type: true, props: true } } },
  })
  if (!home) return

  const hero = home.blocks.find((block) => block.type === 'hero')
  if (hero) {
    const props = (hero.props ?? {}) as Record<string, unknown>
    if (!props.imageId) {
      const imageId = await ensureRealAsset(HERO_PHOTO)
      await db.pageBlock.update({
        where: { id: hero.id },
        data: {
          props: {
            ...props,
            imageId,
            // The cinematic defaults, so a freshly seeded site shows the hero
            // as it is meant to look rather than as an unconfigured band.
            visual: 'image',
            preset: 'cinematic',
            height: 'full',
            focalX: 50,
            focalY: 45,
          },
        },
      })
    }
  }

  if (!home.blocks.some((block) => block.type === 'gallery')) {
    const imageIds: string[] = []
    for (const photo of GALLERY_PHOTOS) {
      imageIds.push(await ensureRealAsset(photo))
    }

    const last = await db.pageBlock.findFirst({
      where: { pageId: home.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })

    await db.pageBlock.create({
      data: {
        pageId: home.id,
        type: 'gallery',
        sortOrder: (last?.sortOrder ?? -1) + 1,
        enabled: true,
        anchor: 'gallery',
        props: { imageIds, layout: 'mosaic' },
        translations: {
          create: [
            {
              locale: 'en',
              props: {
                heading: 'Modern dental practice, in focus',
                body: 'The kind of equipment and treatment rooms our catalogue serves.',
              },
              status: 'APPROVED' as const,
              origin: 'IMPORT' as const,
            },
            {
              locale: 'ru',
              props: {
                heading: 'Современная стоматология крупным планом',
                body: 'Оборудование и кабинеты, для которых работает наш каталог.',
              },
              status: 'APPROVED' as const,
              origin: 'IMPORT' as const,
            },
            {
              locale: 'uz',
              props: {
                heading: 'Zamonaviy stomatologiya yaqindan',
                body: 'Bizning katalogimiz xizmat qiladigan uskuna va davolash xonalari.',
              },
              status: 'APPROVED' as const,
              origin: 'IMPORT' as const,
            },
            {
              locale: 'zh',
              props: {
                heading: '聚焦现代牙科',
                body: '我们的产品目录所服务的设备与诊室环境。',
              },
              status: 'APPROVED' as const,
              origin: 'IMPORT' as const,
            },
          ],
        },
      },
    })
  }
}
