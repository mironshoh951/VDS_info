import { TOTP, Secret } from 'otpauth'
import { db } from '@/server/db/client'
import { encryptSecret, decryptSecret } from '@/lib/crypto'
import { randomToken, sha256 } from '@/lib/ids'
import { hashPassword, verifyPassword } from './password'

/**
 * TOTP multi-factor authentication (RFC 6238).
 *
 * Two details matter beyond "check the code":
 *
 *  - **Replay guard.** A valid code stays valid for its whole 30-second step,
 *    so an intercepted code could otherwise be reused. We record the accepted
 *    time-step counter and refuse anything at or below it.
 *  - **Recovery codes** are hashed exactly like passwords and are single-use.
 */

const PERIOD_SECONDS = 30
const DIGITS = 6
/** Accept one step either side, to tolerate clock drift. */
const WINDOW = 1

export interface EnrollmentChallenge {
  secret: string
  otpauthUrl: string
}

export function createEnrollment(email: string, issuer: string): EnrollmentChallenge {
  const secret = new Secret({ size: 20 })
  const totp = new TOTP({
    issuer,
    label: email,
    algorithm: 'SHA1',
    digits: DIGITS,
    period: PERIOD_SECONDS,
    secret,
  })
  return { secret: secret.base32, otpauthUrl: totp.toString() }
}

function buildTotp(secretBase32: string, email: string, issuer: string): TOTP {
  return new TOTP({
    issuer,
    label: email,
    algorithm: 'SHA1',
    digits: DIGITS,
    period: PERIOD_SECONDS,
    secret: Secret.fromBase32(secretBase32),
  })
}

export function currentCounter(at: number = Date.now()): bigint {
  return BigInt(Math.floor(at / 1000 / PERIOD_SECONDS))
}

export interface VerifyResult {
  valid: boolean
  /** The time-step the code belonged to, for replay protection. */
  counter: bigint | null
  reason?: 'invalid' | 'replayed'
}

/**
 * Verifies a code against the stored secret. `lastUsedCounter` is the highest
 * counter previously accepted for this credential.
 */
export function verifyTotpCode(
  code: string,
  secretBase32: string,
  email: string,
  issuer: string,
  lastUsedCounter: bigint,
  at: number = Date.now(),
): VerifyResult {
  const normalized = code.replace(/\s+/g, '')
  if (!/^\d{6}$/.test(normalized))
    return { valid: false, counter: null, reason: 'invalid' }

  const totp = buildTotp(secretBase32, email, issuer)
  const delta = totp.validate({ token: normalized, window: WINDOW, timestamp: at })

  if (delta === null) return { valid: false, counter: null, reason: 'invalid' }

  const counter = currentCounter(at) + BigInt(delta)
  if (counter <= lastUsedCounter) {
    return { valid: false, counter, reason: 'replayed' }
  }
  return { valid: true, counter }
}

export interface MfaCheckOutcome {
  ok: boolean
  usedRecoveryCode: boolean
  reason?: 'no_credential' | 'invalid' | 'replayed'
}

/**
 * Full verification against the database: tries the TOTP credential first,
 * then recovery codes. Consumes whatever it used.
 */
export async function verifyMfa(
  userId: string,
  email: string,
  code: string,
  issuer: string,
): Promise<MfaCheckOutcome> {
  const credential = await db.mfaCredential.findFirst({
    where: { userId, confirmedAt: { not: null } },
    select: { id: true, secretEnc: true, lastUsedCounter: true },
  })

  if (credential) {
    const result = verifyTotpCode(
      code,
      decryptSecret(credential.secretEnc),
      email,
      issuer,
      credential.lastUsedCounter,
    )
    if (result.valid && result.counter !== null) {
      await db.mfaCredential.update({
        where: { id: credential.id },
        data: { lastUsedCounter: result.counter },
      })
      return { ok: true, usedRecoveryCode: false }
    }
    if (result.reason === 'replayed') {
      return { ok: false, usedRecoveryCode: false, reason: 'replayed' }
    }
  }

  // Fall back to recovery codes.
  const candidates = await db.recoveryCode.findMany({
    where: { userId, usedAt: null },
    select: { id: true, codeHash: true },
  })

  for (const candidate of candidates) {
    if (await verifyPassword(candidate.codeHash, code.trim().toUpperCase())) {
      await db.recoveryCode.update({
        where: { id: candidate.id },
        data: { usedAt: new Date() },
      })
      return { ok: true, usedRecoveryCode: true }
    }
  }

  return {
    ok: false,
    usedRecoveryCode: false,
    reason: credential ? 'invalid' : 'no_credential',
  }
}

/**
 * Generates a fresh set of recovery codes, replacing any existing ones.
 * Returns the plaintext codes — the only time they are ever available.
 */
export async function regenerateRecoveryCodes(
  userId: string,
  count = 10,
): Promise<string[]> {
  const codes = Array.from({ length: count }, () =>
    randomToken(8)
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 10)
      .toUpperCase(),
  )

  await db.$transaction(async (tx) => {
    await tx.recoveryCode.deleteMany({ where: { userId } })
    for (const code of codes) {
      await tx.recoveryCode.create({
        data: { userId, codeHash: await hashPassword(code) },
      })
    }
  })

  return codes
}

/** Stores a confirmed TOTP credential. The seed is encrypted at rest. */
export async function confirmEnrollment(
  userId: string,
  secretBase32: string,
  label = 'Authenticator',
): Promise<void> {
  await db.mfaCredential.create({
    data: {
      userId,
      secretEnc: encryptSecret(secretBase32),
      label,
      confirmedAt: new Date(),
    },
  })
}

export function hashRecoveryToken(value: string): string {
  return sha256(value)
}
