import { forbidden, unauthenticated, stepUpRequired } from '@/lib/errors'
import { recordAudit } from '@/server/security/audit'
import { recordSecurityEvent } from '@/server/security/security-events'
import { consumeStepUpChallenge } from './step-up'
import { requiresStepUp, type Capability, type StepUpScope } from './capabilities'
import { actorId, actorLabel, actorRole, type Actor, type UserActor } from './actor'

/**
 * Server-side authorization (§5, §6).
 *
 * This is the only place a permission decision is made. Use-cases call
 * `requireCapability` as their first statement; the admin UI uses the same
 * capability list to decide what to render, but hiding a button is presentation,
 * not protection — this function is the protection.
 *
 * Every denial is recorded. A stream of denials is what a probe looks like.
 */

export function hasCapability(actor: Actor, capability: Capability): boolean {
  return actor.capabilities.has(capability)
}

export async function requireCapability(
  actor: Actor,
  capability: Capability,
  context?: { entityType?: string; entityId?: string },
): Promise<void> {
  if (actor.kind === 'anonymous') {
    await logDenial(actor, capability, context, 'unauthenticated')
    throw unauthenticated()
  }

  if (!actor.capabilities.has(capability)) {
    await logDenial(actor, capability, context, 'missing_capability')
    throw forbidden(
      'Your account is read-only. Ask a Super Admin if you need to make this change.',
    )
  }
}

async function logDenial(
  actor: Actor,
  capability: Capability,
  context: { entityType?: string; entityId?: string } | undefined,
  reason: string,
): Promise<void> {
  await Promise.all([
    recordAudit({
      actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
      action: 'security.authorization_denied',
      entityLabel: context?.entityType
        ? `${context.entityType}:${context.entityId ?? '-'}`
        : undefined,
      success: false,
      failureReason: `${reason}:${capability}`,
      context: {
        ip: 'ip' in actor ? actor.ip : null,
        userAgent: 'userAgent' in actor ? actor.userAgent : null,
        requestId: actor.requestId,
      },
    }),
    recordSecurityEvent({
      type: 'AUTHORIZATION_DENIED',
      userId: actorId(actor),
      severity: 'warning',
      message: `Denied "${capability}" for ${actorLabel(actor)}.`,
      metadata: { capability, reason, ...context },
      ip: 'ip' in actor ? actor.ip : null,
      userAgent: 'userAgent' in actor ? actor.userAgent : null,
    }),
  ])
}

/**
 * Asserts that a destructive action carries a valid, unconsumed step-up
 * challenge. Throws a typed 428 the client turns into the password prompt.
 *
 * System actors (background jobs) are exempt because they are not reachable
 * from a request; a job that performs a destructive action does so only
 * because a human already confirmed it when the job was enqueued.
 */
export async function requireStepUp(
  actor: Actor,
  scope: StepUpScope,
  challengeToken: string | null | undefined,
): Promise<{ mfaUsed: boolean }> {
  if (actor.kind === 'system') return { mfaUsed: false }
  if (actor.kind !== 'user') throw unauthenticated()

  if (!challengeToken) {
    throw stepUpRequired(scope, actor.mfaSatisfied)
  }

  return consumeStepUpChallenge({
    token: challengeToken,
    userId: actor.userId,
    sessionId: actor.sessionId,
    scope,
  })
}

/**
 * Convenience wrapper for the common shape: check the capability and, when the
 * capability is one of the destructive set, also require step-up.
 */
/**
 * Proof that a step-up challenge has already been consumed in this request.
 *
 * A step-up token is single use — that is the point of it. So an operation made
 * of several writes cannot hand the same token to each one: the first consumes
 * it and the rest are refused as "already used". The batch consumes it once and
 * passes this receipt to the remaining writes instead.
 *
 * The brand is a module-private symbol, so a receipt cannot be constructed
 * anywhere else — least of all deserialized from a request body. That is
 * deliberate: a plain `skipStepUp: true` flag would work identically until the
 * day a route passed it straight through from JSON.
 */
declare const stepUpVerified: unique symbol
export interface StepUpReceipt {
  readonly [stepUpVerified]: true
  readonly scope: StepUpScope
}

function receipt(scope: StepUpScope): StepUpReceipt {
  return { scope } as StepUpReceipt
}

export async function authorize(
  actor: Actor,
  capability: Capability,
  options: {
    scope?: StepUpScope
    challengeToken?: string | null
    entityType?: string
    entityId?: string
    /** A step-up already consumed earlier in this same request. */
    stepUp?: StepUpReceipt
  } = {},
): Promise<{ stepUpUsed: boolean; receipt: StepUpReceipt | null }> {
  await requireCapability(actor, capability, {
    ...(options.entityType ? { entityType: options.entityType } : {}),
    ...(options.entityId ? { entityId: options.entityId } : {}),
  })

  if (requiresStepUp(capability)) {
    if (!options.scope) {
      // A programming error, not a user error: the capability demands a scope.
      throw new Error(
        `Capability "${capability}" requires step-up but no scope was supplied by the caller.`,
      )
    }

    // A receipt from this request stands in for the challenge, but only for the
    // scope it was issued against — a confirmation for one sensitive area must
    // not silently authorise another.
    if (options.stepUp && options.stepUp.scope === options.scope) {
      return { stepUpUsed: true, receipt: options.stepUp }
    }

    await requireStepUp(actor, options.scope, options.challengeToken)
    return { stepUpUsed: true, receipt: receipt(options.scope) }
  }

  return { stepUpUsed: false, receipt: null }
}

/** Narrows an actor to a logged-in user, or throws. */
export function requireUser(actor: Actor): UserActor {
  if (actor.kind !== 'user') throw unauthenticated()
  return actor
}
