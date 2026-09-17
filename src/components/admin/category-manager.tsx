'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { AdminPageHeader } from '@/components/admin/page-header'
import { cn } from '@/lib/cn'
import { LOCALES, DEFAULT_LOCALE } from '@/i18n/config'
import {
  deleteCategoryAction,
  saveCategoryAction,
} from '@/app/(admin)/admin/(workspace)/categories/actions'
import type {
  CategoryKind,
  CategoryNode,
  CategoryTrees,
} from '@/server/modules/catalog/categories'

/**
 * Category administration.
 *
 * Three taxonomies, one screen. The tree is rendered by indentation rather
 * than with expand/collapse: these lists are tens of rows, not thousands, and
 * an editor deciding where a new category belongs needs to see the whole shape
 * at once.
 */

const KINDS: CategoryKind[] = ['product', 'partner', 'article']

interface Draft {
  kind: CategoryKind
  id: string | null
  slug: string
  parentId: string | null
  sortOrder: number
  enabled: boolean
  featured: boolean
  names: Record<string, string>
}

function blankDraft(kind: CategoryKind): Draft {
  return {
    kind,
    id: null,
    slug: '',
    parentId: null,
    sortOrder: 0,
    enabled: true,
    featured: false,
    names: Object.fromEntries(LOCALES.map((locale) => [locale, ''])),
  }
}

function toDraft(kind: CategoryKind, node: CategoryNode): Draft {
  return {
    kind,
    id: node.id,
    slug: node.slug,
    parentId: node.parentId,
    sortOrder: node.sortOrder,
    enabled: node.enabled,
    featured: node.featured,
    names: { ...node.names },
  }
}

export function CategoryManager({
  trees,
  canEdit,
  canDelete,
}: {
  trees: CategoryTrees
  canEdit: boolean
  canDelete: boolean
}) {
  const t = useTranslations('admin.categories')
  const router = useRouter()

  const [kind, setKind] = useState<CategoryKind>('product')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const nodes = trees[kind]
  const supportsTree = kind !== 'article'

  // A category cannot be its own parent, nor a parent of its own ancestor.
  const parentOptions = useMemo(
    () => nodes.filter((node) => node.id !== draft?.id),
    [nodes, draft?.id],
  )

  const save = () => {
    if (!draft) return
    setFieldErrors({})
    startTransition(async () => {
      const outcome = await saveCategoryAction(draft)
      if (outcome.ok) {
        setNotice(t('saved'))
        setDraft(null)
        router.refresh()
      } else {
        setFieldErrors(outcome.fieldErrors ?? {})
        setNotice(outcome.message ?? t('saveFailed'))
      }
    })
  }

  const remove = (node: CategoryNode) => {
    startTransition(async () => {
      const outcome = await deleteCategoryAction({ kind, id: node.id })
      setNotice(outcome.ok ? t('deleted') : (outcome.message ?? t('deleteFailed')))
      if (outcome.ok) {
        setDraft(null)
        router.refresh()
      }
    })
  }

  return (
    <>
      <AdminPageHeader
        title={t('title')}
        description={t('description')}
        actions={
          canEdit ? (
            <Button onClick={() => setDraft(blankDraft(kind))} disabled={pending}>
              <Plus aria-hidden="true" />
              {t('add')}
            </Button>
          ) : undefined
        }
      />

      <div className="mb-5 flex gap-1 border-b border-[var(--border-subtle)]">
        {KINDS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setKind(option)
              setDraft(null)
            }}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm',
              option === kind
                ? 'border-primary-600 text-primary-800 font-medium'
                : 'border-transparent text-neutral-600 hover:text-neutral-900',
            )}
          >
            {t(`kind.${option}`)}
            <span className="text-2xs ml-1.5 text-neutral-400">
              {trees[option].length}
            </span>
          </button>
        ))}
      </div>

      {notice && (
        <p className="bg-primary-50 text-primary-900 mb-4 rounded-md px-3 py-2 text-sm">
          {notice}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-white">
          {nodes.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-neutral-500">
              {t('empty')}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {nodes.map((node) => (
                <li
                  key={node.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{ paddingLeft: `${16 + node.depth * 20}px` }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-neutral-900">
                      {node.names[DEFAULT_LOCALE] || node.slug}
                    </span>
                    <span className="text-2xs block truncate text-neutral-500">
                      /{node.slug} · {t('used', { count: node.usageCount })}
                    </span>
                  </span>

                  {!node.enabled && (
                    <span className="text-2xs rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
                      {t('disabled')}
                    </span>
                  )}
                  {node.featured && (
                    <span className="text-2xs bg-primary-50 text-primary-800 rounded-full px-2 py-0.5">
                      {t('featured')}
                    </span>
                  )}

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setDraft(toDraft(kind, node))}
                      aria-label={t('edit')}
                      className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => remove(node)}
                      disabled={pending}
                      aria-label={t('delete')}
                      className="text-danger-700 hover:bg-danger-50 rounded-md p-1.5"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
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
                {draft.id ? t('editTitle') : t('newTitle')}
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
                    htmlFor={`name-${locale}`}
                  >
                    {t('name')} · {locale.toUpperCase()}
                    {locale === DEFAULT_LOCALE && ' *'}
                  </label>
                  <input
                    id={`name-${locale}`}
                    value={draft.names[locale] ?? ''}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        names: { ...draft.names, [locale]: event.target.value },
                      })
                    }
                    className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                  />
                  {fieldErrors[`names.${locale}`] && (
                    <p className="text-danger-700 mt-1 text-xs">
                      {fieldErrors[`names.${locale}`]}
                    </p>
                  )}
                </div>
              ))}

              <div>
                <label
                  className="mb-1 block text-xs font-medium text-neutral-700"
                  htmlFor="category-slug"
                >
                  {t('slug')} *
                </label>
                <input
                  id="category-slug"
                  value={draft.slug}
                  onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
                  className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 font-mono text-sm"
                />
                {fieldErrors.slug && (
                  <p className="text-danger-700 mt-1 text-xs">{fieldErrors.slug}</p>
                )}
              </div>

              {supportsTree && (
                <div>
                  <label
                    className="mb-1 block text-xs font-medium text-neutral-700"
                    htmlFor="category-parent"
                  >
                    {t('parent')}
                  </label>
                  <select
                    id="category-parent"
                    value={draft.parentId ?? ''}
                    onChange={(event) =>
                      setDraft({ ...draft, parentId: event.target.value || null })
                    }
                    className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                  >
                    <option value="">{t('noParent')}</option>
                    {parentOptions.map((node) => (
                      <option key={node.id} value={node.id}>
                        {'— '.repeat(node.depth)}
                        {node.names[DEFAULT_LOCALE] || node.slug}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label
                  className="mb-1 block text-xs font-medium text-neutral-700"
                  htmlFor="category-order"
                >
                  {t('sortOrder')}
                </label>
                <input
                  id="category-order"
                  type="number"
                  min={0}
                  value={draft.sortOrder}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      sortOrder: Number.parseInt(event.target.value, 10) || 0,
                    })
                  }
                  className="w-28 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) =>
                    setDraft({ ...draft, enabled: event.target.checked })
                  }
                />
                {t('enabled')}
              </label>

              {kind === 'product' && (
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={draft.featured}
                    onChange={(event) =>
                      setDraft({ ...draft, featured: event.target.checked })
                    }
                  />
                  {t('featured')}
                </label>
              )}
            </div>

            <footer className="border-t border-[var(--border-subtle)] px-4 py-3">
              <Button onClick={save} disabled={pending} block>
                {pending ? t('saving') : t('save')}
              </Button>
            </footer>
          </aside>
        )}
      </div>
    </>
  )
}
