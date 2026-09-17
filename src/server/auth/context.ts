import { getActiveSession, touchSession } from './session'
import { getRequestContext } from '@/server/security/request-context'
import { ROLE_CAPABILITIES } from './capabilities'
import { anonymousActor, type Actor, type UserActor } from './actor'
import { unauthenticated } from '@/lib/errors'

/**
 * Turns the incoming request into an `Actor`.
 *
 * This is the bridge between HTTP and the domain layer. Everything below it
 * takes an explicit actor; nothing below it reads cookies.
 */

export async function getActor(): Promise<Actor> {
  const context = await getRequestContext()
  const session = await getActiveSession(context.host)

  if (!session) {
    return anonymousActor({
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    })
  }

  // An MFA-enrolled user who has not completed the challenge is authenticated
  // but not yet authorized — they hold no capabilities.
  const mfaComplete = !session.user.mfaEnrolled || session.mfaSatisfied

  await touchSession(session)

  return {
    kind: 'user',
    userId: session.user.id,
    role: session.user.role,
    email: session.user.email,
    name: session.user.name,
    sessionId: session.id,
    mfaSatisfied: session.mfaSatisfied,
    capabilities: mfaComplete ? ROLE_CAPABILITIES[session.user.role] : new Set(),
    ip: context.ip,
    userAgent: context.userAgent,
    requestId: context.requestId,
    locale: session.user.locale,
  }
}

/** For admin pages and handlers: an actor that must be a signed-in user. */
export async function requireActor(): Promise<UserActor> {
  const actor = await getActor()
  if (actor.kind !== 'user') throw unauthenticated()
  return actor
}

/**
 * Returns the session that still needs MFA, if any. The login flow uses this
 * to render the second step without granting any authorization first.
 */
export async function getPendingMfaSession() {
  const context = await getRequestContext()
  const session = await getActiveSession(context.host)
  if (!session) return null
  if (!session.user.mfaEnrolled || session.mfaSatisfied) return null
  return session
}
