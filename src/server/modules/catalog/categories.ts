import { db, type DbTransaction } from '@/server/db/client'
import { authorize } from '@/server/auth/guard'
import { actorId, actorLabel, actorRole, type Actor } from '@/server/auth/actor'
import { recordAudit } from '@/server/security/audit'
import { conflict, notFound, validationFailed } from '@/lib/errors'
import { LOCALES, DEFAULT_LOCALE } from '@/i18n/config'

/**
 * Category administration (§14).
 *
 * Three taxonomies share one screen because they are the same job to an
 * editor, but they are not the same shape underneath: product categories form
 * a tree with a materialised path, partner categories a flat-ish tree, and
 * article categories keep their names in a JSON column rather than a
 * translation table. The differences are absorbed here so the screen can treat
 * them uniformly.
 */

export const CATEGORY_KINDS = ['product', 'partner', 'article'] as const
export type CategoryKind = (typeof CATEGORY_KINDS)[number]

export interface CategoryNode {
  id: string
  slug: string
  parentId: string | null
  depth: number
  sortOrder: number
  enabled: boolean
  featured: boolean
  usageCount: number
  names: Record<string, string>
  slugs: Record<string, string>
}

export interface CategoryTrees {
  product: CategoryNode[]
  partner: CategoryNode[]
  article: CategoryNode[]
}

function emptyNames(): Record<string, string> {
  return Object.fromEntries(LOCALES.map((locale) => [locale, '']))
}

function normaliseSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function listCategories(actor: Actor): Promise<CategoryTrees> {
  await authorize(actor, 'content.read')

  const [products, partners, articles] = await Promise.all([
    db.productCategory.findMany({
      where: { deletedAt: null },
      orderBy: [{ path: 'asc' }, { sortOrder: 'asc' }],
      select: {
        id: true,
        slug: true,
        parentId: true,
        depth: true,
        sortOrder: true,
        enabled: true,
        featured: true,
        translations: { select: { locale: true, name: true, slug: true } },
        _count: { select: { products: true } },
      },
    }),
    db.partnerCategory.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }],
      select: {
        id: true,
        slug: true,
        parentId: true,
        sortOrder: true,
        enabled: true,
        translations: { select: { locale: true, name: true, slug: true } },
        _count: { select: { partners: true } },
      },
    }),
    db.articleCategory.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }],
      select: {
        id: true,
        slug: true,
        sortOrder: true,
        enabled: true,
        names: true,
        _count: { select: { articles: true } },
      },
    }),
  ])

  const fromTranslations = (
    rows: { locale: string; name: string; slug: string | null }[],
  ): { names: Record<string, string>; slugs: Record<string, string> } => {
    const names = emptyNames()
    const slugs = emptyNames()
    for (const row of rows) {
      names[row.locale] = row.name
      slugs[row.locale] = row.slug ?? ''
    }
    return { names, slugs }
  }

  return {
    product: products.map((row) => ({
      id: row.id,
      slug: row.slug,
      parentId: row.parentId,
      depth: row.depth,
      sortOrder: row.sortOrder,
      enabled: row.enabled,
      featured: row.featured,
      usageCount: row._count.products,
      ...fromTranslations(row.translations),
    })),
    partner: partners.map((row) => ({
      id: row.id,
      slug: row.slug,
      parentId: row.parentId,
      depth: row.parentId ? 1 : 0,
      sortOrder: row.sortOrder,
      enabled: row.enabled,
      featured: false,
      usageCount: row._count.partners,
      ...fromTranslations(row.translations),
    })),
    article: articles.map((row) => {
      const stored = (row.names ?? {}) as Record<string, unknown>
      const names = emptyNames()
      for (const locale of LOCALES) {
        const value = stored[locale]
        if (typeof value === 'string') names[locale] = value
      }
      return {
        id: row.id,
        slug: row.slug,
        parentId: null,
        depth: 0,
        sortOrder: row.sortOrder,
        enabled: row.enabled,
        featured: false,
        usageCount: row._count.articles,
        names,
        slugs: emptyNames(),
      }
    }),
  }
}

export interface SaveCategoryInput {
  kind: CategoryKind
  id: string | null
  slug: string
  parentId: string | null
  sortOrder: number
  enabled: boolean
  featured: boolean
  names: Record<string, string>
}

export async function saveCategory(
  actor: Actor,
  input: SaveCategoryInput,
): Promise<{ id: string }> {
  await authorize(actor, input.id ? 'content.update' : 'content.create')

  const slug = normaliseSlug(input.slug)
  const defaultName = input.names[DEFAULT_LOCALE]?.trim()

  const problems = []
  if (!slug)
    problems.push({ field: 'slug', code: 'required', message: 'A slug is required.' })
  if (!defaultName) {
    problems.push({
      field: `names.${DEFAULT_LOCALE}`,
      code: 'required',
      message: 'A name in the source language is required.',
    })
  }
  if (problems.length > 0) throw validationFailed(problems)

  const id =
    input.kind === 'product'
      ? await saveProductCategory(input, slug)
      : input.kind === 'partner'
        ? await savePartnerCategory(input, slug)
        : await saveArticleCategory(input, slug)

  await recordAudit({
    actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
    action: input.id ? 'category.updated' : 'category.created',
    entityType: input.kind === 'product' ? 'PRODUCT_CATEGORY' : 'PARTNER_CATEGORY',
    entityId: id,
    entityLabel: `${input.kind}:${slug}`,
    after: { slug, enabled: input.enabled, name: defaultName },
  })

  return { id }
}

/**
 * Product categories carry a materialised path so the public site can query a
 * subtree without recursion. That path has to be rebuilt for every descendant
 * whenever a slug or a parent changes — otherwise a rename silently detaches
 * every child URL beneath it.
 */
async function saveProductCategory(
  input: SaveCategoryInput,
  slug: string,
): Promise<string> {
  const parent = input.parentId
    ? await db.productCategory.findFirst({
        where: { id: input.parentId, deletedAt: null },
        select: { id: true, path: true, depth: true },
      })
    : null

  if (input.parentId && !parent) throw notFound('That parent category no longer exists.')
  if (input.id && input.parentId === input.id) {
    throw conflict('A category cannot be its own parent.')
  }

  const path = parent ? `${parent.path}/${slug}` : slug
  const depth = parent ? parent.depth + 1 : 0

  const clash = await db.productCategory.findFirst({
    where: { slug, deletedAt: null, ...(input.id ? { id: { not: input.id } } : {}) },
    select: { id: true },
  })
  if (clash) throw conflict('Another category already uses that slug.')

  const record = await db.$transaction(async (tx) => {
    const saved = input.id
      ? await tx.productCategory.update({
          where: { id: input.id },
          data: {
            slug,
            parentId: parent?.id ?? null,
            path,
            depth,
            sortOrder: input.sortOrder,
            enabled: input.enabled,
            featured: input.featured,
          },
          select: { id: true },
        })
      : await tx.productCategory.create({
          data: {
            slug,
            parentId: parent?.id ?? null,
            path,
            depth,
            sortOrder: input.sortOrder,
            enabled: input.enabled,
            featured: input.featured,
          },
          select: { id: true },
        })

    for (const locale of LOCALES) {
      const name = input.names[locale]?.trim()
      if (!name) continue
      await tx.productCategoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: saved.id, locale } },
        create: { categoryId: saved.id, locale, name, status: 'APPROVED' },
        update: { name, status: 'APPROVED' },
      })
    }

    if (input.id) await rebuildSubtree(tx, saved.id, path, depth)

    return saved
  })

  return record.id
}

async function rebuildSubtree(
  tx: DbTransaction,
  parentId: string,
  parentPath: string,
  parentDepth: number,
): Promise<void> {
  const children = await tx.productCategory.findMany({
    where: { parentId, deletedAt: null },
    select: { id: true, slug: true },
  })

  for (const child of children) {
    const path = `${parentPath}/${child.slug}`
    const depth = parentDepth + 1
    await tx.productCategory.update({ where: { id: child.id }, data: { path, depth } })
    await rebuildSubtree(tx, child.id, path, depth)
  }
}

async function savePartnerCategory(
  input: SaveCategoryInput,
  slug: string,
): Promise<string> {
  const clash = await db.partnerCategory.findFirst({
    where: { slug, deletedAt: null, ...(input.id ? { id: { not: input.id } } : {}) },
    select: { id: true },
  })
  if (clash) throw conflict('Another category already uses that slug.')
  if (input.id && input.parentId === input.id) {
    throw conflict('A category cannot be its own parent.')
  }

  return db.$transaction(async (tx) => {
    const saved = input.id
      ? await tx.partnerCategory.update({
          where: { id: input.id },
          data: {
            slug,
            parentId: input.parentId,
            sortOrder: input.sortOrder,
            enabled: input.enabled,
          },
          select: { id: true },
        })
      : await tx.partnerCategory.create({
          data: {
            slug,
            parentId: input.parentId,
            sortOrder: input.sortOrder,
            enabled: input.enabled,
          },
          select: { id: true },
        })

    for (const locale of LOCALES) {
      const name = input.names[locale]?.trim()
      if (!name) continue
      await tx.partnerCategoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: saved.id, locale } },
        create: { categoryId: saved.id, locale, name, status: 'APPROVED' },
        update: { name, status: 'APPROVED' },
      })
    }

    return saved.id
  })
}

async function saveArticleCategory(
  input: SaveCategoryInput,
  slug: string,
): Promise<string> {
  const clash = await db.articleCategory.findFirst({
    where: { slug, deletedAt: null, ...(input.id ? { id: { not: input.id } } : {}) },
    select: { id: true },
  })
  if (clash) throw conflict('Another category already uses that slug.')

  const names: Record<string, string> = {}
  for (const locale of LOCALES) {
    const name = input.names[locale]?.trim()
    if (name) names[locale] = name
  }

  const saved = input.id
    ? await db.articleCategory.update({
        where: { id: input.id },
        data: { slug, sortOrder: input.sortOrder, enabled: input.enabled, names },
        select: { id: true },
      })
    : await db.articleCategory.create({
        data: { slug, sortOrder: input.sortOrder, enabled: input.enabled, names },
        select: { id: true },
      })

  return saved.id
}

/**
 * Soft delete, and only when nothing points at it. A category that still has
 * products would otherwise vanish from the admin while its items keep
 * rendering a link to a page that no longer exists.
 */
export async function deleteCategory(
  actor: Actor,
  input: { kind: CategoryKind; id: string },
): Promise<void> {
  await authorize(actor, 'content.delete.soft')

  const now = new Date()

  if (input.kind === 'product') {
    const category = await db.productCategory.findFirst({
      where: { id: input.id, deletedAt: null },
      select: {
        slug: true,
        _count: { select: { products: true, children: true } },
      },
    })
    if (!category) throw notFound('That category no longer exists.')
    if (category._count.children > 0) {
      throw conflict('Move or remove the sub-categories first.')
    }
    if (category._count.products > 0) {
      throw conflict(`${category._count.products} product(s) still use this category.`)
    }
    await db.productCategory.update({ where: { id: input.id }, data: { deletedAt: now } })
  } else if (input.kind === 'partner') {
    const category = await db.partnerCategory.findFirst({
      where: { id: input.id, deletedAt: null },
      select: { slug: true, _count: { select: { partners: true, children: true } } },
    })
    if (!category) throw notFound('That category no longer exists.')
    if (category._count.children > 0)
      throw conflict('Move or remove the sub-categories first.')
    if (category._count.partners > 0) {
      throw conflict(`${category._count.partners} partner(s) still use this category.`)
    }
    await db.partnerCategory.update({ where: { id: input.id }, data: { deletedAt: now } })
  } else {
    const category = await db.articleCategory.findFirst({
      where: { id: input.id, deletedAt: null },
      select: { slug: true, _count: { select: { articles: true } } },
    })
    if (!category) throw notFound('That category no longer exists.')
    if (category._count.articles > 0) {
      throw conflict(`${category._count.articles} article(s) still use this category.`)
    }
    await db.articleCategory.update({ where: { id: input.id }, data: { deletedAt: now } })
  }

  await recordAudit({
    actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
    action: 'category.deleted',
    entityType: input.kind === 'product' ? 'PRODUCT_CATEGORY' : 'PARTNER_CATEGORY',
    entityId: input.id,
    entityLabel: `${input.kind}:${input.id}`,
  })
}
