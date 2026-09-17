import { Prisma } from './generated/client'

/**
 * Models that use soft deletion (§59). Anything listed here gets
 * `deletedAt: null` injected into reads and has `delete`/`deleteMany`
 * rewritten into an update.
 *
 * Audit logs, security events, analytics and job records are deliberately
 * absent: they are append-only history, not content.
 */
export const SOFT_DELETE_MODELS = new Set<string>([
  'User',
  'Page',
  'Menu',
  'MenuItem',
  'MediaFolder',
  'MediaAsset',
  'Partner',
  'PartnerCategory',
  'Brand',
  'Product',
  'ProductCategory',
  'Service',
  'Achievement',
  'Event',
  'Article',
  'ArticleCategory',
  'Resource',
  'Certificate',
  'Office',
  'TeamMember',
  'Milestone',
  'Testimonial',
  'Faq',
  'Form',
  'Inquiry',
  'Banner',
])

/**
 * Escape hatch for the trash/restore screens. Callers opt in explicitly:
 *
 *   db.product.findMany({ where: { ...includeDeleted } })
 *
 * which reads clearly in review — unlike a silent global flag.
 */
export const includeDeleted = { deletedAt: undefined } as const

type ReadArgs = { where?: Record<string, unknown> } | undefined

function withNotDeleted(args: ReadArgs): Record<string, unknown> {
  const next = { ...(args ?? {}) } as { where?: Record<string, unknown> }
  const where = { ...(next.where ?? {}) }

  // `deletedAt: undefined` is the explicit opt-out written by `includeDeleted`.
  if (!('deletedAt' in where)) {
    where.deletedAt = null
  } else if (where.deletedAt === undefined) {
    delete where.deletedAt
  }

  next.where = where
  return next as Record<string, unknown>
}

export const softDeleteExtension = Prisma.defineExtension({
  name: 'soft-delete',
  query: {
    $allModels: {
      async findFirst({ model, args, query }) {
        if (!SOFT_DELETE_MODELS.has(model)) return query(args)
        return query(withNotDeleted(args) as typeof args)
      },
      async findFirstOrThrow({ model, args, query }) {
        if (!SOFT_DELETE_MODELS.has(model)) return query(args)
        return query(withNotDeleted(args) as typeof args)
      },
      async findMany({ model, args, query }) {
        if (!SOFT_DELETE_MODELS.has(model)) return query(args)
        return query(withNotDeleted(args) as typeof args)
      },
      async count({ model, args, query }) {
        if (!SOFT_DELETE_MODELS.has(model)) return query(args)
        return query(withNotDeleted(args) as typeof args)
      },
      async aggregate({ model, args, query }) {
        if (!SOFT_DELETE_MODELS.has(model)) return query(args)
        return query(withNotDeleted(args) as typeof args)
      },
      /**
       * `delete` and `deleteMany` become updates. Permanent removal is a
       * separate, explicitly named use-case that uses `dbRaw` and requires
       * step-up authentication (§7, §59).
       */
      async delete({ model, args, query }) {
        if (!SOFT_DELETE_MODELS.has(model)) return query(args)
        const client = Prisma.getExtensionContext(this) as unknown as {
          update: (a: unknown) => Promise<unknown>
        }
        return client.update({
          where: (args as { where: unknown }).where,
          data: { deletedAt: new Date() },
        })
      },
      async deleteMany({ model, args, query }) {
        if (!SOFT_DELETE_MODELS.has(model)) return query(args)
        const client = Prisma.getExtensionContext(this) as unknown as {
          updateMany: (a: unknown) => Promise<unknown>
        }
        return client.updateMany({
          where: (args as { where?: unknown } | undefined)?.where ?? {},
          data: { deletedAt: new Date() },
        })
      },
    },
  },
})
