import { db, type DbTransaction } from '@/server/db/client'
import { authorize } from '@/server/auth/guard'
import { actorId, actorLabel, actorRole, type Actor } from '@/server/auth/actor'
import { recordAudit } from '@/server/security/audit'
import { conflict, notFound, validationFailed } from '@/lib/errors'
import { LOCALES, DEFAULT_LOCALE } from '@/i18n/config'
import { invalidateNavigation, ROUTE_KEYS } from './service'
import type { MenuItemTarget, MenuLocation } from '@/server/db/generated/enums'

/**
 * Menu administration (§15).
 *
 * A menu item can point at ten different things, so the editor needs two
 * lists: the targets it may choose between, and the options within whichever
 * it chose. Both are assembled here, because the alternative — the browser
 * asking for options each time the target changes — turns a dropdown into a
 * loading state on a screen where the whole point is to see the structure.
 */

export const MENU_TARGETS: MenuItemTarget[] = [
  'NONE',
  'ROUTE',
  'PAGE',
  'EXTERNAL_URL',
  'PRODUCT_CATEGORY',
  'PRODUCT',
  'SERVICE',
  'PARTNER',
  'BRAND',
  'EVENT',
  'ARTICLE',
]

export interface MenuItemNode {
  id: string
  parentId: string | null
  depth: number
  sortOrder: number
  enabled: boolean
  target: MenuItemTarget
  entityId: string | null
  routeKey: string | null
  externalUrl: string | null
  openInNewTab: boolean
  highlight: boolean
  labels: Record<string, string>
}

export interface MenuSummary {
  id: string
  key: string
  name: string
  location: MenuLocation
  enabled: boolean
  isSystem: boolean
  items: MenuItemNode[]
}

export interface TargetOption {
  id: string
  label: string
}

export interface MenuEditorData {
  menus: MenuSummary[]
  routeKeys: string[]
  options: Record<string, TargetOption[]>
}

/** The column that holds the id, per target. NONE/ROUTE/EXTERNAL_URL hold none. */
const ENTITY_COLUMN: Partial<Record<MenuItemTarget, string>> = {
  PAGE: 'pageId',
  PRODUCT: 'productId',
  PRODUCT_CATEGORY: 'productCategoryId',
  PARTNER: 'partnerId',
  BRAND: 'brandId',
  SERVICE: 'serviceId',
  EVENT: 'eventId',
  ARTICLE: 'articleId',
}

const OPTION_LIMIT = 200

export async function getMenuEditorData(actor: Actor): Promise<MenuEditorData> {
  await authorize(actor, 'menu.read')

  const [menus, options] = await Promise.all([loadMenus(), loadTargetOptions()])
  return { menus, routeKeys: ROUTE_KEYS, options }
}

async function loadMenus(): Promise<MenuSummary[]> {
  const rows = await db.menu.findMany({
    where: { deletedAt: null },
    orderBy: [{ location: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      key: true,
      name: true,
      location: true,
      enabled: true,
      isSystem: true,
      items: {
        where: { deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }],
        select: {
          id: true,
          parentId: true,
          sortOrder: true,
          enabled: true,
          target: true,
          pageId: true,
          productId: true,
          productCategoryId: true,
          partnerId: true,
          brandId: true,
          serviceId: true,
          eventId: true,
          articleId: true,
          routeKey: true,
          externalUrl: true,
          openInNewTab: true,
          highlight: true,
          translations: { select: { locale: true, label: true } },
        },
      },
    },
  })

  return rows.map((menu) => {
    const flat = menu.items.map((item) => {
      const labels = Object.fromEntries(LOCALES.map((locale) => [locale, '']))
      for (const translation of item.translations) {
        labels[translation.locale] = translation.label
      }

      const entityId =
        item.pageId ??
        item.productId ??
        item.productCategoryId ??
        item.partnerId ??
        item.brandId ??
        item.serviceId ??
        item.eventId ??
        item.articleId ??
        null

      return {
        id: item.id,
        parentId: item.parentId,
        depth: 0,
        sortOrder: item.sortOrder,
        enabled: item.enabled,
        target: item.target,
        entityId,
        routeKey: item.routeKey,
        externalUrl: item.externalUrl,
        openInNewTab: item.openInNewTab,
        highlight: item.highlight,
        labels,
      }
    })

    return {
      id: menu.id,
      key: menu.key,
      name: menu.name,
      location: menu.location,
      enabled: menu.enabled,
      isSystem: menu.isSystem,
      items: orderAsTree(flat),
    }
  })
}

/**
 * Flattens the parent/child relation into the order it is displayed, with a
 * depth on each row. Rendering a real nested list would mean the reorder
 * buttons have to reason about two different structures; one ordered list with
 * an indent level keeps both the markup and the move logic simple.
 */
function orderAsTree(items: MenuItemNode[]): MenuItemNode[] {
  const byParent = new Map<string | null, MenuItemNode[]>()
  for (const item of items) {
    const siblings = byParent.get(item.parentId) ?? []
    siblings.push(item)
    byParent.set(item.parentId, siblings)
  }

  const out: MenuItemNode[] = []
  const walk = (parentId: string | null, depth: number) => {
    const siblings = (byParent.get(parentId) ?? []).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    )
    for (const item of siblings) {
      out.push({ ...item, depth })
      walk(item.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

async function loadTargetOptions(): Promise<Record<string, TargetOption[]>> {
  const locale = DEFAULT_LOCALE
  const take = OPTION_LIMIT

  const [pages, products, categories, partners, brands, services, events, articles] =
    await Promise.all([
      db.page.findMany({
        where: { deletedAt: null },
        take,
        select: {
          id: true,
          translations: { where: { locale }, select: { title: true } },
        },
      }),
      db.product.findMany({
        where: { deletedAt: null },
        take,
        select: { id: true, translations: { where: { locale }, select: { name: true } } },
      }),
      db.productCategory.findMany({
        where: { deletedAt: null },
        take,
        select: {
          id: true,
          slug: true,
          translations: { where: { locale }, select: { name: true } },
        },
      }),
      db.partner.findMany({
        where: { deletedAt: null },
        take,
        select: { id: true, translations: { where: { locale }, select: { name: true } } },
      }),
      db.brand.findMany({
        where: { deletedAt: null },
        take,
        select: { id: true, translations: { where: { locale }, select: { name: true } } },
      }),
      db.service.findMany({
        where: { deletedAt: null },
        take,
        select: { id: true, translations: { where: { locale }, select: { name: true } } },
      }),
      db.event.findMany({
        where: { deletedAt: null },
        take,
        select: {
          id: true,
          translations: { where: { locale }, select: { title: true } },
        },
      }),
      db.article.findMany({
        where: { deletedAt: null },
        take,
        select: {
          id: true,
          translations: { where: { locale }, select: { title: true } },
        },
      }),
    ])

  const named = <T extends { id: string; translations: { name: string }[] }>(rows: T[]) =>
    rows.map((row) => ({ id: row.id, label: row.translations[0]?.name ?? row.id }))
  const titled = <T extends { id: string; translations: { title: string }[] }>(
    rows: T[],
  ) => rows.map((row) => ({ id: row.id, label: row.translations[0]?.title ?? row.id }))

  return {
    PAGE: titled(pages),
    PRODUCT: named(products),
    PRODUCT_CATEGORY: categories.map((row) => ({
      id: row.id,
      label: row.translations[0]?.name ?? row.slug,
    })),
    PARTNER: named(partners),
    BRAND: named(brands),
    SERVICE: named(services),
    EVENT: titled(events),
    ARTICLE: titled(articles),
  }
}

export interface SaveMenuItemInput {
  menuId: string
  id: string | null
  parentId: string | null
  target: MenuItemTarget
  entityId: string | null
  routeKey: string | null
  externalUrl: string | null
  enabled: boolean
  openInNewTab: boolean
  highlight: boolean
  labels: Record<string, string>
}

export async function saveMenuItem(
  actor: Actor,
  input: SaveMenuItemInput,
): Promise<{ id: string }> {
  await authorize(actor, 'menu.manage')

  const label = input.labels[DEFAULT_LOCALE]?.trim()
  const problems = []

  if (!label) {
    problems.push({
      field: `labels.${DEFAULT_LOCALE}`,
      code: 'required',
      message: 'A label in the source language is required.',
    })
  }

  // Exactly one of the target's payloads is meaningful. Validating it here
  // rather than trusting the form means a crafted request cannot store an item
  // that renders as a dead link.
  if (input.target === 'ROUTE' && !ROUTE_KEYS.includes(input.routeKey ?? '')) {
    problems.push({
      field: 'routeKey',
      code: 'invalid',
      message: 'Choose a page to link to.',
    })
  }
  if (input.target === 'EXTERNAL_URL') {
    try {
      const url = new URL(input.externalUrl ?? '')
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('scheme')
    } catch {
      problems.push({
        field: 'externalUrl',
        code: 'invalid',
        message: 'Enter a full address starting with http:// or https://',
      })
    }
  }
  if (ENTITY_COLUMN[input.target] && !input.entityId) {
    problems.push({
      field: 'entityId',
      code: 'required',
      message: 'Choose an item to link to.',
    })
  }
  if (input.id && input.parentId === input.id) {
    problems.push({
      field: 'parentId',
      code: 'invalid',
      message: 'An item cannot sit under itself.',
    })
  }

  if (problems.length > 0) throw validationFailed(problems)

  const menu = await db.menu.findFirst({
    where: { id: input.menuId, deletedAt: null },
    select: { id: true, name: true },
  })
  if (!menu) throw notFound('That menu no longer exists.')

  // Every target column is cleared and only the relevant one set, so changing
  // an item's target cannot leave a stale id behind in another column.
  const targetColumns: Record<string, string | null> = {
    pageId: null,
    productId: null,
    productCategoryId: null,
    partnerId: null,
    brandId: null,
    serviceId: null,
    eventId: null,
    articleId: null,
  }
  const column = ENTITY_COLUMN[input.target]
  if (column) targetColumns[column] = input.entityId

  const data = {
    menuId: menu.id,
    parentId: input.parentId,
    target: input.target,
    routeKey: input.target === 'ROUTE' ? input.routeKey : null,
    externalUrl: input.target === 'EXTERNAL_URL' ? input.externalUrl : null,
    enabled: input.enabled,
    openInNewTab: input.openInNewTab,
    highlight: input.highlight,
    ...targetColumns,
  }

  const saved = await db.$transaction(async (tx) => {
    const record = input.id
      ? await tx.menuItem.update({
          where: { id: input.id },
          data,
          select: { id: true },
        })
      : await tx.menuItem.create({
          data: {
            ...data,
            sortOrder: await nextSortOrder(tx, menu.id, input.parentId),
            visibleLocales: [],
          },
          select: { id: true },
        })

    for (const locale of LOCALES) {
      const text = input.labels[locale]?.trim()
      if (!text) continue
      await tx.menuItemTranslation.upsert({
        where: { itemId_locale: { itemId: record.id, locale } },
        create: { itemId: record.id, locale, label: text, status: 'APPROVED' },
        update: { label: text, status: 'APPROVED' },
      })
    }

    return record
  })

  await recordAudit({
    actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
    action: input.id ? 'menu_item.updated' : 'menu_item.created',
    entityType: 'MENU_ITEM',
    entityId: saved.id,
    entityLabel: `${menu.name}: ${label}`,
    after: { target: input.target, enabled: input.enabled },
  })

  await invalidateNavigation()
  return { id: saved.id }
}

async function nextSortOrder(
  tx: DbTransaction,
  menuId: string,
  parentId: string | null,
): Promise<number> {
  const last = await tx.menuItem.findFirst({
    where: { menuId, parentId, deletedAt: null },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  return (last?.sortOrder ?? -1) + 1
}

export async function deleteMenuItem(actor: Actor, id: string): Promise<void> {
  await authorize(actor, 'menu.manage')

  const item = await db.menuItem.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, _count: { select: { children: true } } },
  })
  if (!item) throw notFound('That item no longer exists.')
  if (item._count.children > 0) throw conflict('Remove the items underneath it first.')

  await db.menuItem.update({ where: { id }, data: { deletedAt: new Date() } })

  await recordAudit({
    actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
    action: 'menu_item.deleted',
    entityType: 'MENU_ITEM',
    entityId: id,
  })

  await invalidateNavigation()
}

/**
 * Swaps an item with its neighbour. Reordering by swapping two rows — rather
 * than renumbering the whole list — keeps the write small and means a failed
 * request leaves the order it found.
 */
export async function moveMenuItem(
  actor: Actor,
  input: { id: string; direction: 'up' | 'down' },
): Promise<void> {
  await authorize(actor, 'menu.manage')

  const item = await db.menuItem.findFirst({
    where: { id: input.id, deletedAt: null },
    select: { id: true, menuId: true, parentId: true, sortOrder: true },
  })
  if (!item) throw notFound('That item no longer exists.')

  const neighbour = await db.menuItem.findFirst({
    where: {
      menuId: item.menuId,
      parentId: item.parentId,
      deletedAt: null,
      sortOrder:
        input.direction === 'up' ? { lt: item.sortOrder } : { gt: item.sortOrder },
    },
    orderBy: { sortOrder: input.direction === 'up' ? 'desc' : 'asc' },
    select: { id: true, sortOrder: true },
  })
  if (!neighbour) return

  await db.$transaction([
    db.menuItem.update({
      where: { id: item.id },
      data: { sortOrder: neighbour.sortOrder },
    }),
    db.menuItem.update({
      where: { id: neighbour.id },
      data: { sortOrder: item.sortOrder },
    }),
  ])

  await invalidateNavigation()
}

export async function saveMenu(
  actor: Actor,
  input: { id: string; name: string; enabled: boolean },
): Promise<void> {
  await authorize(actor, 'menu.manage')

  const name = input.name.trim()
  if (!name) {
    throw validationFailed([
      { field: 'name', code: 'required', message: 'A name is required.' },
    ])
  }

  const menu = await db.menu.findFirst({
    where: { id: input.id, deletedAt: null },
    select: { id: true, name: true, enabled: true },
  })
  if (!menu) throw notFound('That menu no longer exists.')

  await db.menu.update({ where: { id: menu.id }, data: { name, enabled: input.enabled } })

  await recordAudit({
    actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
    action: 'menu.updated',
    entityType: 'MENU',
    entityId: menu.id,
    entityLabel: name,
    before: { name: menu.name, enabled: menu.enabled },
    after: { name, enabled: input.enabled },
  })

  await invalidateNavigation()
}
