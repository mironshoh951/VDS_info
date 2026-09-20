import { Worker, type Job } from 'bullmq'
import { db } from '@/server/db/client'
import { getQueueRedis } from '@/server/cache/redis'
import { systemActor } from '@/server/auth/actor'
import { translateRecord } from '@/server/modules/ai/translate'
import { logger } from '@/lib/logger'
import type { ResourceKey } from '@/server/modules/admin/resources'
import {
  QUEUE_TRANSLATION,
  closeQueues,
  translationJobSchema,
  type TranslationJob,
} from './queues'

/**
 * The background worker.
 *
 * Same image as the web container, different entrypoint: one build, one set of
 * dependencies, no second copy of the domain code to keep in step. It consumes
 * the queues the application fills and nothing else — it serves no HTTP, and
 * it is never reachable from outside.
 *
 * Concurrency is deliberately low. The work is AI calls against a shared
 * monthly budget, and running twenty at once would not finish a batch any
 * sooner — the provider rate-limits, the budget guard trips, and the failures
 * all land at the same moment. Two at a time keeps a batch moving while
 * leaving room for a person in the editor to get a translation immediately.
 */

const CONCURRENCY = Number(process.env['WORKER_CONCURRENCY'] ?? 2)

/** Long enough to finish a job, short enough to beat the runtime's SIGKILL. */
const SHUTDOWN_TIMEOUT_MS = 15_000

/** A job that BullMQ has handed us, already validated. */
async function runTranslation(job: Job<TranslationJob>): Promise<void> {
  const payload = translationJobSchema.parse(job.data)
  const startedAt = new Date()

  await db.jobRun
    .update({
      where: { id: job.id ?? '' },
      data: { status: 'PROCESSING', attempts: job.attemptsMade + 1, startedAt },
    })
    .catch(() => undefined)

  // The worker acts as the system, not as the person who queued the job: the
  // request that queued it is long gone, along with its session. Who asked is
  // carried in the payload and written to the row, so the trail survives.
  const actor = systemActor(
    payload.requestedByLabel
      ? `worker (queued by ${payload.requestedByLabel})`
      : 'worker',
    job.id ?? null,
  )

  const outcome = await translateRecord(actor, {
    resourceKey: payload.resourceKey as ResourceKey,
    id: payload.id,
    ...(payload.targetLocales ? { targetLocales: payload.targetLocales } : {}),
  })

  const finishedAt = new Date()

  await db.jobRun
    .update({
      where: { id: job.id ?? '' },
      data: {
        status: 'COMPLETED',
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        result: {
          translated: outcome.translated.map((entry) => entry.locale),
          skipped: outcome.skipped,
          costMicros: outcome.costMicros,
        },
      },
    })
    .catch(() => undefined)
}

function start(): Worker<TranslationJob> {
  const worker = new Worker<TranslationJob>(QUEUE_TRANSLATION, runTranslation, {
    connection: getQueueRedis(),
    concurrency: Number.isFinite(CONCURRENCY) && CONCURRENCY > 0 ? CONCURRENCY : 2,
  })

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, queue: QUEUE_TRANSLATION }, 'job completed')
  })

  worker.on('failed', (job, error) => {
    logger.error(
      { jobId: job?.id, attempts: job?.attemptsMade, err: error },
      'job failed',
    )

    // Only the final attempt closes the row. Marking it FAILED on the first
    // of three would tell an operator the batch had failed while it was still
    // being retried.
    const exhausted = job ? job.attemptsMade >= (job.opts.attempts ?? 1) : true
    if (!job?.id || !exhausted) return

    const finishedAt = new Date()
    void db.jobRun
      .update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          attempts: job.attemptsMade,
          error: error.message.slice(0, 1000),
          finishedAt,
        },
      })
      .catch(() => undefined)
  })

  worker.on('error', (error) => {
    logger.error({ err: error }, 'worker error')
  })

  return worker
}

/**
 * Shutdown is not optional.
 *
 * A container is stopped with SIGTERM and killed shortly after. Without this,
 * a translation in flight is lost halfway — the AI call has been paid for, and
 * the row still says PROCESSING. `close()` lets the job finish and hands the
 * rest back to the queue for the next worker to pick up.
 */
function installShutdown(worker: Worker<TranslationJob>): void {
  let closing = false

  const stop = (signal: string) => {
    if (closing) return
    closing = true
    logger.info({ signal }, 'worker shutting down')

    // A closing worker waits for Redis, and an unreachable Redis is exactly
    // when a container is most likely to be restarted. Without this the
    // process ignores SIGTERM until the runtime loses patience and sends
    // SIGKILL, which is a worse ending than a slightly early one.
    const forced = setTimeout(() => {
      logger.warn('shutdown timed out; exiting anyway')
      process.exit(0)
    }, SHUTDOWN_TIMEOUT_MS)
    forced.unref()

    void worker
      .close()
      .then(closeQueues)
      .then(() => {
        clearTimeout(forced)
        process.exit(0)
      })
      .catch((error) => {
        logger.error({ err: error }, 'worker shutdown failed')
        process.exit(1)
      })
  }

  process.on('SIGTERM', () => stop('SIGTERM'))
  process.on('SIGINT', () => stop('SIGINT'))
}

const worker = start()
installShutdown(worker)

logger.info({ queue: QUEUE_TRANSLATION, concurrency: CONCURRENCY }, 'worker started')
