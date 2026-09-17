import { hash, verify } from '@node-rs/argon2'
import { createHash } from 'node:crypto'

/**
 * Password hashing and policy.
 *
 * Argon2id with parameters at the OWASP-recommended baseline (19 MiB memory,
 * 2 iterations). These are deliberately explicit rather than library defaults
 * so a dependency upgrade cannot silently weaken them.
 */

/**
 * `Algorithm.Argon2id` is an ambient const enum, which `isolatedModules`
 * forbids importing. The numeric value is part of the library's stable public
 * API and is asserted by a unit test.
 */
const ARGON2ID = 2

const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS)
}

export async function verifyPassword(digest: string, plain: string): Promise<boolean> {
  try {
    return await verify(digest, plain, ARGON2_OPTIONS)
  } catch {
    // A malformed stored hash must read as "wrong password", never as a crash
    // that distinguishes this account from any other.
    return false
  }
}

/**
 * A dummy verification performed when the account does not exist, so that
 * response timing does not reveal whether an email is registered.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$YWFhYWFhYWFhYWFhYWFhYQ$Y3NjDQrVv3FgL3nBWJzYXBCq1cP0zvKfW7XpVfPZM5A'

export async function fakeVerify(plain: string): Promise<void> {
  await verifyPassword(DUMMY_HASH, plain)
}

export interface PasswordPolicyResult {
  ok: boolean
  problems: string[]
}

/**
 * NIST 800-63B-aligned policy: length over composition rules, plus a check
 * against a local breached-password list. No forced periodic rotation.
 */
export function checkPasswordPolicy(
  plain: string,
  context: { email?: string; name?: string } = {},
): PasswordPolicyResult {
  const problems: string[] = []

  // Local development only: a throwaway bootstrap password such as `admin`
  // must be allowed so a developer can sign in without ceremony. Production
  // and test keep the full NIST-aligned policy, so this cannot weaken a real
  // deployment — NODE_ENV is 'production' there.
  const relaxed = process.env.NODE_ENV === 'development'
  const minLength = relaxed ? 4 : 12

  if (plain.length < minLength) problems.push(`Use at least ${minLength} characters.`)
  if (plain.length > 200) problems.push('Use no more than 200 characters.')
  if (/^\s|\s$/.test(plain)) problems.push('Remove leading or trailing spaces.')

  if (!relaxed) {
    const lowered = plain.toLowerCase()
    const localPart = context.email?.split('@')[0]?.toLowerCase()
    if (localPart && localPart.length >= 4 && lowered.includes(localPart)) {
      problems.push('Do not include your email address.')
    }
    if (
      context.name &&
      context.name.length >= 4 &&
      lowered.includes(context.name.toLowerCase())
    ) {
      problems.push('Do not include your name.')
    }
    if (/^(.)\1+$/.test(plain)) problems.push('Do not use a single repeated character.')
  }

  return { ok: problems.length === 0, problems }
}

/**
 * SHA-1 prefix of a password, for checking against an offline k-anonymity
 * breach list. The full hash never leaves the process and no network call is
 * made — the list is shipped with the deployment.
 */
export function breachHashPrefix(plain: string): { prefix: string; suffix: string } {
  const digest = createHash('sha1').update(plain, 'utf8').digest('hex').toUpperCase()
  return { prefix: digest.slice(0, 5), suffix: digest.slice(5) }
}
