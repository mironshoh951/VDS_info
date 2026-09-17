import { revokeSession, clearSessionCookies } from './session'
import { recordAudit } from '@/server/security/audit'
import { recordSecurityEvent } from '@/server/security/security-events'
import { actorId, actorLabel, actorRole, type Actor } from './actor'

/**
 * Sign out.
 *
 * The session is revoked server-side before the cookie is cleared, so a copy
 * of the cookie captured elsewhere is dead too — clearing the cookie alone
 * would leave the session valid for anyone who still had the token.
 */
export async function logout(actor: Actor): Promise<void> {
  if (actor.kind === 'user') {
    await revokeSession(actor.sessionId, 'user_signed_out')

    await Promise.all([
      recordAudit({
        actor: { id: actorId(actor), role: actorRole(actor), label: actorLabel(actor) },
        action: 'auth.logout',
        context: { ip: actor.ip, userAgent: actor.userAgent, requestId: actor.requestId },
      }),
      recordSecurityEvent({
        type: 'LOGOUT',
        userId: actor.userId,
        message: 'Signed out.',
        ip: actor.ip,
        userAgent: actor.userAgent,
      }),
    ])
  }

  await clearSessionCookies()
}
