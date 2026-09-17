import { describe, expect, it } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  checkPasswordPolicy,
  breachHashPrefix,
} from './password'

describe('password hashing', () => {
  it('produces an argon2id digest that verifies', async () => {
    const digest = await hashPassword('correct horse battery staple')
    // Guards the hardcoded algorithm id: the stored digest must say argon2id.
    expect(digest.startsWith('$argon2id$')).toBe(true)
    expect(digest).toContain('m=19456')
    expect(digest).toContain('t=2')
    await expect(verifyPassword(digest, 'correct horse battery staple')).resolves.toBe(
      true,
    )
  })

  it('rejects the wrong password', async () => {
    const digest = await hashPassword('correct horse battery staple')
    await expect(verifyPassword(digest, 'Correct horse battery staple')).resolves.toBe(
      false,
    )
  })

  it('treats a malformed digest as a failed verification, not an error', async () => {
    await expect(verifyPassword('not-a-hash', 'anything')).resolves.toBe(false)
  })
})

describe('password policy', () => {
  it('requires at least 12 characters', () => {
    expect(checkPasswordPolicy('short').ok).toBe(false)
    expect(checkPasswordPolicy('a-long-enough-passphrase').ok).toBe(true)
  })

  it('rejects a password containing the email local part', () => {
    const result = checkPasswordPolicy('mironshoh-secret-1', {
      email: 'mironshoh@example.com',
    })
    expect(result.ok).toBe(false)
    expect(result.problems.join(' ')).toContain('email')
  })

  it('rejects a single repeated character', () => {
    expect(checkPasswordPolicy('aaaaaaaaaaaaaa').ok).toBe(false)
  })
})

describe('breach hash prefix', () => {
  it('splits the SHA-1 digest into a 5-character prefix and remainder', () => {
    const { prefix, suffix } = breachHashPrefix('password')
    expect(prefix).toHaveLength(5)
    expect(`${prefix}${suffix}`).toHaveLength(40)
    // Known SHA-1 of "password", uppercased.
    expect(`${prefix}${suffix}`).toBe('5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8')
  })
})
