import { Queue } from 'bullmq'
import { z } from 'zod'
import { db } from '@/server/db/client'
import { getQueueRedis, redisAvailable } from '@/server/cache/redis'
import { dependencyUnavailable } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { LOCALES } from '@/i18n/config'
import { RESOURCE_KEYS } from '@/server/modules/admin/resources'

/**
 * Queue definitions.
 *
 * The work that belongs here is the work a person should not have to watch: AI
 * translation of a hundred products takes minutes and a request that waits for
 * it will be cut off by a proxy long before it finishes. Moving it to a queue
 * is not an optimisation — it is the difference between a bulk action that
 * works and one that appears to hang and is clicked again.
 *
 * Every enqueue also writes a `JobRun` row. BullMQ keeps its own state in
 * Redis, but Redis is a cache: it can be flushed, and it is not where an
 * operator should have to look to answer "did the translation of that batch
 * ever run". The row is the durable record; the queue is the mechanism.
 */

export const QUEUE_TRANSLATION = 'translation'

export const translationJobSchema = z.object({
  resourceKey: z.enum(RESOURCE_KEYS as [string, ...string[]]),
  id: z.string().uuid(),
  targetLocales: z.array(z.enum(LOCALES)).optional(),
  /** Who asked for it, so the audit trail survives the hop into the worker. */
  requestedBy: z.string().nullable().default(null),
  requestedByLabel: z.string().nullable().default(null),
})

export type TranslationJob = z.infer<typeof translationJobSchema>

const globalForQueues = globalThis as unknown as { __vdsTranslationQueue?: Queue }

/**
 * Created on first use, not at import.
 *
 * A module-level `new Queue()` would open a Redis connection merely because
 * something in the request path imported this file — including during
 * `next build`, where there is no Redis and no work to queue.
 */
function translationQueue(): Queue {
  if (!globalForQueues.__vdsTranslationQueue) {
    globalForQueues.__vdsTranslationQueue = new Queue(QUEUE_TRANSLATION, {
      connection: getQueueRedis(),
      defaultJobOptions: {
        // Three attempts with backoff: the usual failure is a provider
        // rate-limiting us, which is exactly the failure retrying fixes.
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        // Keep a short tail in Redis for the dashboard; the durable history is
        // in `job_runs`.
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    })
  }
  return globalForQueues.__vdsTranslationQueue
}

export async function enqueueTranslation(input: TranslationJob): Promise<string> {
  const payload = translationJobSchema.parse(input)

  // Checked before the write, so a queue-less deployment reports the real
  // problem instead of leaving a QUEUED row that nothing will ever pick up.
  if (!redisAvailable()) {
    throw dependencyUnavailable(
      'The job queue is not reachable. Start Redis, or translate records one at a time.',
    )
  }

  const run = await db.jobRun.create({
    data: {
      queue: QUEUE_TRANSLATION,
      jobName: 'translate-record',
      status: 'QUEUED',
      payload,
    },
    select: { id: true },
  })

  try {
    // The JobRun id is the BullMQ job id, so the two records are the same
    // thing seen from two sides and neither needs a lookup table.
    await translationQueue().add('translate-record', payload, { jobId: run.id })
  } catch (error) {
    await db.jobRun
      .update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Could not enqueue',
          finishedAt: new Date(),
        },
      })
      .catch(() => undefined)

    logger.error({ err: error }, 'failed to enqueue translation job')
    throw dependencyUnavailable('The job could not be queued.')
  }

  return run.id
}

/** Closes the queue's own connection. Used by the worker's shutdown path. */
export async function closeQueues(): Promise<void> {
  const queue = globalForQueues.__vdsTranslationQueue
  if (!queue) return
  globalForQueues.__vdsTranslationQueue = undefined
  await queue.close()
}
