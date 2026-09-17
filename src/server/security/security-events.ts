import { db } from '@/server/db/client'
import { logger } from '@/lib/logger'
import type { SecurityEventType } from '@/server/db/generated/enums'

/**
 * Security telemetry — the feed behind the admin Security Center (§65).
 * Separate from the audit log: audit answers "who changed what", security
 * events answer "what happened to the authentication surface".
 */

export type Severity = 'info' | 'warning' | 'critical'

export interface SecurityEventInput {
  type: SecurityEventType
  userId?: string | null
  severity?: Severity
  message: string
  metadata?: Record<string, unknown>
  ip?: string | null
  userAgent?: string | null
}

export async function recordSecurityEvent(input: SecurityEventInput): Promise<void> {
  try {
    await db.securityEvent.create({
      data: {
        type: input.type,
        userId: input.userId ?? null,
        severity: input.severity ?? 'info',
        message: input.message,
        metadata: (input.metadata ?? undefined) as object | undefined,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    })
  } catch (error) {
    logger.error({ err: error, type: input.type }, 'security event write failed')
  }

  if ((input.severity ?? 'info') === 'critical') {
    logger.warn({ type: input.type, userId: input.userId }, input.message)
  }
}
