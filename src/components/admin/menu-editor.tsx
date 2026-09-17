'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, X, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui'
import { AdminPageHeader } from '@/components/admin/page-header'
import { cn } from '@/lib/cn'
import { LOCALES, DEFAULT_LOCALE } from '@/i18n/config'
import {
  deleteMenuItemAction,
  moveMenuItemAction,
  saveMenuAction,
  saveMenuItemAction,
} from '@/app/(admin)/admin/(workspace)/menus/actions'
import type {
  MenuEditorData,
  MenuItemNode,
  MenuSummary,
} from '@/server/modules/navigation/menu-admin'

/**
 * Menu editor.
 *
 * Ordering is done with explicit up/down buttons rather than drag and drop.
 * Dragging is pleasant with a mouse and close to unusable with a keyboard or
 * on a touch screen, and this is a screen an editor may well be using on a
 * tablet in an office. Two buttons work everywhere and can be undone by
 * pressing the other one.
 */

const TARGETS = [
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
] as const

type Target = (typeof TARGETS)[number]

interface Draft {
  menuId: string
  id: string | null
  parentId: string | null
  target: Target
  entityId: string | null
  routeKey: string | null
  externalUrl: string | null
  enabled: boolean
  openInNewTab: boolean
  highlight: boolean
  labels: Record<string, string>
}

function blankDraft(menuId: string, parentId: string | null): Draft {
  return {
    menuId,
    id: null,
    parentId,
    target: 'ROUTE',
    entityId: null,
    routeKey: null,
    externalUrl: null,
    enabled: true,
    openInNewTab: false,
    highlight: false,
    labels: Object.fromEntries(LOCALES.map((locale) => [locale, ''])),
  }
}

function toDraft(menuId: string, item: MenuItemNode): Draft {
  return {
    menuId,
    id: item.id,
    parentId: item.parentId,
    target: item.target as Target,
    entityId: item.entityId,
    routeKey: item.routeKey,
    externalUrl: item.externalUrl,
    enabled: item.enabled,
    openInNewTab: item.openInNewTab,
    highlight: item.highlight,
    labels: { ...item.labels },
  }
}

export function MenuEditor({
  data,
  canManage,
}: {
  data: MenuEditorData
  canManage: boolean
}) {
  const t = useTranslations('admin.menus')
  const router = useRouter()

  const [menuId, setMenuId] = useState(data.menus[0]?.id ?? '')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const menu: MenuSummary | undefined = useMemo(
    () => data.menus.find((entry) => entry.id === menuId),
    [data.menus, menuId],
  )

  const parentOptions = useMemo(
    () => (menu?.items ?? []).filter((item) => item.id !== draft?.id && item.depth < 2),
    [menu, draft?.id],
  )

  const run = (
    work: () => Promise<{
      ok: boolean
      message?: string
      fieldErrors?: Record<string, string>
    }>,
    success: string,
  ) =>
    startTransition(async () => {
      const outcome = await work()
      if (outcome.ok) {
        setNotice(success)
        setFieldErrors({})
        setDraft(null)
        router.refresh()
      } else {
        setFieldErrors(outcome.fieldErrors ?? {})
        setNotice(outcome.message ?? t('failed'))
      }
    })

  if (!menu) {
    return (
      <>
        <AdminPageHeader title={t('title')} description={t('description')} />
        <p className="rounded-lg border border-dashed border-[var(--border-strong)] bg-white px-6 py-14 text-center text-sm text-neutral-500">
          {t('noMenus')}
        </p>
      </>
    )
  }

  const needsEntity = !['NONE', 'ROUTE', 'EXTERNAL_URL'].includes(draft?.target ?? '')
  const entityOptions = draft ? (data.options[draft.target] ?? []) : []

  return (
    <>
      <AdminPageHeader
        title={t('title')}
        description={t('description')}
        actions={
          canManage ? (
            <Button
              onClick={() => setDraft(blankDraft(menu.id, null))}
              disabled={pending}
            >
              <Plus aria-hidden="true" />
              {t('addItem')}
            </Button>
          ) : undefined
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <label htmlFor="menu-select" className="text-sm text-neutral-600">
          {t('menu')}
        </label>
        <select
          id="menu-select"
          value={menuId}
          onChange={(event) => {
            setMenuId(event.target.value)
            setDraft(null)
          }}
          className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
        >
          {data.menus.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name} · {t(`location.${entry.location}`)}
              {entry.enabled ? '' : ` (${t('hidden')})`}
            </option>
          ))}
        </select>

        {canManage && (
          <label className="ml-2 flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={menu.enabled}
              disabled={pending}
              onChange={(event) =>
                run(
                  () =>
                    saveMenuAction({
                      id: menu.id,
                      name: menu.name,
                      enabled: event.target.checked,
                    }),
                  t('saved'),
                )
              }
            />
            {t('menuEnabled')}
          </label>
        )}
        {menu.isSystem && (
          <span className="text-2xs rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
            {t('system')}
          </span>
        )}
      </div>

      {notice && (
        <p className="bg-primary-50 text-primary-900 mb-4 rounded-md px-3 py-2 text-sm">
          {notice}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-white">
          {menu.items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-neutral-500">
              {t('noItems')}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {menu.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 px-4 py-2.5"
                  style={{ paddingLeft: `${16 + item.depth * 24}px` }}
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block truncate text-sm',
                        item.enabled
                          ? 'text-neutral-900'
                          : 'text-neutral-400 line-through',
                      )}
                    >
                      {item.labels[DEFAULT_LOCALE] || t('untitled')}
                      {item.highlight && (
                        <span className="text-2xs bg-primary-50 text-primary-800 ml-2 rounded-full px-1.5 py-0.5">
                          {t('highlight')}
                        </span>
                      )}
                    </span>
                    <span className="text-2xs flex items-center gap-1 truncate text-neutral-500">
                      {t(`target.${item.target}`)}
                      {item.routeKey && ` · ${item.routeKey}`}
                      {item.externalUrl && (
                        <>
                          {' · '}
                          {item.externalUrl}
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </>
                      )}
                    </span>
                  </span>

                  {canManage && (
                    <>
                      <button
                        type="button"
                        aria-label={t('moveUp')}
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => moveMenuItemAction({ id: item.id, direction: 'up' }),
                            t('moved'),
                          )
                        }
                        className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={t('moveDown')}
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => moveMenuItemAction({ id: item.id, direction: 'down' }),
                            t('moved'),
                          )
                        }
                        className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={t('addChild')}
                        onClick={() => setDraft(blankDraft(menu.id, item.id))}
                        className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={t('edit')}
                        onClick={() => setDraft(toDraft(menu.id, item))}
                        className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={t('delete')}
                        disabled={pending}
                        onClick={() =>
                          run(() => deleteMenuItemAction({ id: item.id }), t('deleted'))
                        }
                        className="text-danger-700 hover:bg-danger-50 rounded-md p-1.5"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {draft && (
          <aside className="h-fit rounded-lg border border-[var(--border-subtle)] bg-white">
            <header className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">
                {draft.id ? t('editItem') : t('newItem')}
              </h2>
              <button
                type="button"
                onClick={() => setDraft(null)}
                aria-label={t('close')}
                className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="space-y-4 px-4 py-4">
              {LOCALES.map((locale) => (
                <div key={locale}>
                  <label
                    className="mb-1 block text-xs font-medium text-neutral-700"
                    htmlFor={`label-${locale}`}
                  >
                    {t('label')} · {locale.toUpperCase()}
                    {locale === DEFAULT_LOCALE && ' *'}
                  </label>
                  <input
                    id={`label-${locale}`}
                    value={draft.labels[locale] ?? ''}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        labels: { ...draft.labels, [locale]: event.target.value },
                      })
                    }
                    className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                  />
                  {fieldErrors[`labels.${locale}`] && (
                    <p className="text-danger-700 mt-1 text-xs">
                      {fieldErrors[`labels.${locale}`]}
                    </p>
                  )}
                </div>
              ))}

              <div>
                <label
                  className="mb-1 block text-xs font-medium text-neutral-700"
                  htmlFor="item-target"
                >
                  {t('linksTo')}
                </label>
                <select
                  id="item-target"
                  value={draft.target}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      target: event.target.value as Target,
                      entityId: null,
                      routeKey: null,
                      externalUrl: null,
                    })
                  }
                  className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                >
                  {TARGETS.map((target) => (
                    <option key={target} value={target}>
                      {t(`target.${target}`)}
                    </option>
                  ))}
                </select>
              </div>

              {draft.target === 'ROUTE' && (
                <div>
                  <label
                    className="mb-1 block text-xs font-medium text-neutral-700"
                    htmlFor="item-route"
                  >
                    {t('page')} *
                  </label>
                  <select
                    id="item-route"
                    value={draft.routeKey ?? ''}
                    onChange={(event) =>
                      setDraft({ ...draft, routeKey: event.target.value || null })
                    }
                    className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                  >
                    <option value="">{t('choose')}</option>
                    {data.routeKeys.map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.routeKey && (
                    <p className="text-danger-700 mt-1 text-xs">{fieldErrors.routeKey}</p>
                  )}
                </div>
              )}

              {draft.target === 'EXTERNAL_URL' && (
                <div>
                  <label
                    className="mb-1 block text-xs font-medium text-neutral-700"
                    htmlFor="item-url"
                  >
                    {t('url')} *
                  </label>
                  <input
                    id="item-url"
                    value={draft.externalUrl ?? ''}
                    placeholder="https://"
                    onChange={(event) =>
                      setDraft({ ...draft, externalUrl: event.target.value || null })
                    }
                    className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                  />
                  {fieldErrors.externalUrl && (
                    <p className="text-danger-700 mt-1 text-xs">
                      {fieldErrors.externalUrl}
                    </p>
                  )}
                </div>
              )}

              {needsEntity && (
                <div>
                  <label
                    className="mb-1 block text-xs font-medium text-neutral-700"
                    htmlFor="item-entity"
                  >
                    {t('item')} *
                  </label>
                  <select
                    id="item-entity"
                    value={draft.entityId ?? ''}
                    onChange={(event) =>
                      setDraft({ ...draft, entityId: event.target.value || null })
                    }
                    className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                  >
                    <option value="">{t('choose')}</option>
                    {entityOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.entityId && (
                    <p className="text-danger-700 mt-1 text-xs">{fieldErrors.entityId}</p>
                  )}
                </div>
              )}

              <div>
                <label
                  className="mb-1 block text-xs font-medium text-neutral-700"
                  htmlFor="item-parent"
                >
                  {t('parent')}
                </label>
                <select
                  id="item-parent"
                  value={draft.parentId ?? ''}
                  onChange={(event) =>
                    setDraft({ ...draft, parentId: event.target.value || null })
                  }
                  className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                >
                  <option value="">{t('topLevel')}</option>
                  {parentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {'— '.repeat(option.depth)}
                      {option.labels[DEFAULT_LOCALE] || t('untitled')}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) =>
                    setDraft({ ...draft, enabled: event.target.checked })
                  }
                />
                {t('visible')}
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={draft.openInNewTab}
                  onChange={(event) =>
                    setDraft({ ...draft, openInNewTab: event.target.checked })
                  }
                />
                {t('newTab')}
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={draft.highlight}
                  onChange={(event) =>
                    setDraft({ ...draft, highlight: event.target.checked })
                  }
                />
                {t('highlightField')}
              </label>
            </div>

            <footer className="border-t border-[var(--border-subtle)] px-4 py-3">
              <Button
                onClick={() => run(() => saveMenuItemAction(draft), t('saved'))}
                disabled={pending}
                block
              >
                {pending ? t('saving') : t('save')}
              </Button>
            </footer>
          </aside>
        )}
      </div>
    </>
  )
}
