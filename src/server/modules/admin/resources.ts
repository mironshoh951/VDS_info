import { db, dbRaw } from '@/server/db/client'
import type { EntityType } from '@/server/db/generated/enums'

/**
 * The registry of manageable content types.
 *
 * Publish, archive, restore and delete behave identically for a product, a
 * partner and an article — only the table differs. Describing each resource
 * once here means those operations are implemented once, audited once and
 * tested once, instead of nine near-identical copies drifting apart (§78).
 */

export type ResourceKey =
  | 'product'
  | 'partner'
  | 'brand'
  | 'service'
  | 'event'
  | 'article'
  | 'resource'
  | 'certificate'
  | 'achievement'
  | 'page'

/** The narrow slice of a Prisma delegate these operations need. */
interface LifecycleDelegate {
  findUnique(args: {
    where: { id: string }
    select: Record<string, boolean>
  }): Promise<Record<string, unknown> | null>
  findFirst(args: {
    where: Record<string, unknown>
    select: Record<string, boolean>
  }): Promise<Record<string, unknown> | null>
  findMany(args: {
    where?: Record<string, unknown>
    select: Record<string, unknown>
    orderBy?: unknown
    skip?: number
    take?: number
  }): Promise<Record<string, unknown>[]>
  update(args: {
    where: { id: string }
    data: Record<string, unknown>
    select?: Record<string, boolean>
  }): Promise<Record<string, unknown>>
  updateMany(args: {
    where: Record<string, unknown>
    data: Record<string, unknown>
  }): Promise<{ count: number }>
  delete(args: { where: { id: string } }): Promise<unknown>
  count(args?: { where?: Record<string, unknown> }): Promise<number>
}

export interface ResourceDefinition {
  key: ResourceKey
  entityType: EntityType
  /** Singular label used in confirmations and audit entries. */
  label: string
  labelPlural: string
  /** Admin route segment. */
  path: string
  /** Public route segment, or null when the entity has no public detail page. */
  publicPath: string | null
  /** True when the table has a `status` column with the publication lifecycle. */
  hasStatus: boolean
  /** True when the table has a `featured` flag. */
  hasFeatured: boolean
  /** Column holding the human-readable name on the base row, if any. */
  titleField: string | null
  /** The delegate used for ordinary (non-deleted) reads and writes. */
  delegate: () => LifecycleDelegate
  /** The unextended delegate, for trash and permanent deletion. */
  rawDelegate: () => LifecycleDelegate
  /** Name of the translation delegate, used to read a display title. */
  translationDelegate:
    | (() => {
        findFirst(args: {
          where: Record<string, unknown>
          select: Record<string, boolean>
        }): Promise<Record<string, unknown> | null>
      })
    | null
  /** Foreign key on the translation row pointing back at the base row. */
  translationForeignKey: string | null
  /** Field on the translation row holding the title. */
  translationTitleField: string
}

/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma delegates have
   per-model generic types that cannot be expressed as one union without
   losing all of them; the narrow LifecycleDelegate interface above is what
   callers actually see. */
const asDelegate = (value: unknown) => value as any as LifecycleDelegate
const asTranslationDelegate = (value: unknown) =>
  value as any as NonNullable<
    ResourceDefinition['translationDelegate']
  > extends () => infer R
    ? R
    : never
/* eslint-enable @typescript-eslint/no-explicit-any */

export const RESOURCES: Record<ResourceKey, ResourceDefinition> = {
  product: {
    key: 'product',
    entityType: 'PRODUCT',
    label: 'Product',
    labelPlural: 'Products',
    path: 'products',
    publicPath: 'products',
    hasStatus: true,
    hasFeatured: true,
    titleField: null,
    delegate: () => asDelegate(db.product),
    rawDelegate: () => asDelegate(dbRaw.product),
    translationDelegate: () => asTranslationDelegate(db.productTranslation),
    translationForeignKey: 'productId',
    translationTitleField: 'name',
  },
  partner: {
    key: 'partner',
    entityType: 'PARTNER',
    label: 'Partner',
    labelPlural: 'Partners',
    path: 'partners',
    publicPath: 'partners',
    hasStatus: true,
    hasFeatured: true,
    titleField: 'displayName',
    delegate: () => asDelegate(db.partner),
    rawDelegate: () => asDelegate(dbRaw.partner),
    translationDelegate: () => asTranslationDelegate(db.partnerTranslation),
    translationForeignKey: 'partnerId',
    translationTitleField: 'name',
  },
  brand: {
    key: 'brand',
    entityType: 'BRAND',
    label: 'Brand',
    labelPlural: 'Brands',
    path: 'brands',
    publicPath: 'brands',
    hasStatus: true,
    hasFeatured: true,
    titleField: 'name',
    delegate: () => asDelegate(db.brand),
    rawDelegate: () => asDelegate(dbRaw.brand),
    translationDelegate: () => asTranslationDelegate(db.brandTranslation),
    translationForeignKey: 'brandId',
    translationTitleField: 'name',
  },
  service: {
    key: 'service',
    entityType: 'SERVICE',
    label: 'Service',
    labelPlural: 'Services',
    path: 'services',
    publicPath: 'services',
    hasStatus: true,
    hasFeatured: true,
    titleField: null,
    delegate: () => asDelegate(db.service),
    rawDelegate: () => asDelegate(dbRaw.service),
    translationDelegate: () => asTranslationDelegate(db.serviceTranslation),
    translationForeignKey: 'serviceId',
    translationTitleField: 'name',
  },
  event: {
    key: 'event',
    entityType: 'EVENT',
    label: 'Event',
    labelPlural: 'Events',
    path: 'events',
    publicPath: 'events',
    hasStatus: true,
    hasFeatured: true,
    titleField: null,
    delegate: () => asDelegate(db.event),
    rawDelegate: () => asDelegate(dbRaw.event),
    translationDelegate: () => asTranslationDelegate(db.eventTranslation),
    translationForeignKey: 'eventId',
    translationTitleField: 'title',
  },
  article: {
    key: 'article',
    entityType: 'ARTICLE',
    label: 'Article',
    labelPlural: 'News',
    path: 'news',
    publicPath: 'news',
    hasStatus: true,
    hasFeatured: true,
    titleField: null,
    delegate: () => asDelegate(db.article),
    rawDelegate: () => asDelegate(dbRaw.article),
    translationDelegate: () => asTranslationDelegate(db.articleTranslation),
    translationForeignKey: 'articleId',
    translationTitleField: 'title',
  },
  resource: {
    key: 'resource',
    entityType: 'RESOURCE',
    label: 'Resource',
    labelPlural: 'Resources',
    path: 'resources',
    publicPath: 'resources',
    hasStatus: true,
    hasFeatured: true,
    titleField: null,
    delegate: () => asDelegate(db.resource),
    rawDelegate: () => asDelegate(dbRaw.resource),
    translationDelegate: () => asTranslationDelegate(db.resourceTranslation),
    translationForeignKey: 'resourceId',
    translationTitleField: 'title',
  },
  certificate: {
    key: 'certificate',
    entityType: 'CERTIFICATE',
    label: 'Certificate',
    labelPlural: 'Trust centre',
    path: 'certificates',
    publicPath: 'certificates',
    hasStatus: true,
    hasFeatured: true,
    titleField: null,
    delegate: () => asDelegate(db.certificate),
    rawDelegate: () => asDelegate(dbRaw.certificate),
    translationDelegate: () => asTranslationDelegate(db.certificateTranslation),
    translationForeignKey: 'certificateId',
    translationTitleField: 'title',
  },
  achievement: {
    key: 'achievement',
    entityType: 'ACHIEVEMENT',
    label: 'Achievement',
    labelPlural: 'Achievements',
    path: 'achievements',
    publicPath: 'achievements',
    hasStatus: true,
    hasFeatured: true,
    titleField: null,
    delegate: () => asDelegate(db.achievement),
    rawDelegate: () => asDelegate(dbRaw.achievement),
    translationDelegate: () => asTranslationDelegate(db.achievementTranslation),
    translationForeignKey: 'achievementId',
    translationTitleField: 'title',
  },
  page: {
    key: 'page',
    entityType: 'PAGE',
    label: 'Page',
    labelPlural: 'Pages',
    path: 'pages',
    publicPath: '',
    hasStatus: true,
    hasFeatured: false,
    titleField: null,
    delegate: () => asDelegate(db.page),
    rawDelegate: () => asDelegate(dbRaw.page),
    translationDelegate: () => asTranslationDelegate(db.pageTranslation),
    translationForeignKey: 'pageId',
    translationTitleField: 'title',
  },
}

export function resourceFor(key: string): ResourceDefinition | null {
  return (RESOURCES as Record<string, ResourceDefinition | undefined>)[key] ?? null
}

export const RESOURCE_KEYS = Object.keys(RESOURCES) as ResourceKey[]
