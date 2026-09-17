import { describe, expect, it } from 'vitest'
import { TOTP, Secret } from 'otpauth'
import { createEnrollment, verifyTotpCode, currentCounter } from './mfa'

const ISSUER = 'VDS Platform'
const EMAIL = 'admin@example.com'

function codeFor(secretBase32: string, at: number): string {
  return new TOTP({
    issuer: ISSUER,
    label: EMAIL,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  }).generate({ timestamp: at })
}

describe('TOTP enrollment', () => {
  it('produces a base32 secret and an otpauth URL naming the issuer', () => {
    const { secret, otpauthUrl } = createEnrollment(EMAIL, ISSUER)
    expect(secret).toMatch(/^[A-Z2-7]+$/)
    expect(otpauthUrl.startsWith('otpauth://totp/')).toBe(true)
    expect(otpauthUrl).toContain(encodeURIComponent(ISSUER))
  })
})

describe('TOTP verification', () => {
  const { secret } = createEnrollment(EMAIL, ISSUER)
  const now = 1_700_000_000_000

  it('accepts the current code', () => {
    const result = verifyTotpCode(codeFor(secret, now), secret, EMAIL, ISSUER, 0n, now)
    expect(result.valid).toBe(true)
    expect(result.counter).toBe(currentCounter(now))
  })

  it('rejects a malformed code without touching the secret', () => {
    expect(verifyTotpCode('12ab56', secret, EMAIL, ISSUER, 0n, now).valid).toBe(false)
    expect(verifyTotpCode('', secret, EMAIL, ISSUER, 0n, now).valid).toBe(false)
  })

  it('rejects a code from far outside the drift window', () => {
    const stale = codeFor(secret, now - 10 * 60 * 1000)
    expect(verifyTotpCode(stale, secret, EMAIL, ISSUER, 0n, now).valid).toBe(false)
  })

  it('tolerates one step of clock drift', () => {
    const slightlyEarly = codeFor(secret, now - 30_000)
    expect(verifyTotpCode(slightlyEarly, secret, EMAIL, ISSUER, 0n, now).valid).toBe(true)
  })

  it('refuses to accept the same code twice (replay guard)', () => {
    const code = codeFor(secret, now)
    const first = verifyTotpCode(code, secret, EMAIL, ISSUER, 0n, now)
    expect(first.valid).toBe(true)

    const replay = verifyTotpCode(code, secret, EMAIL, ISSUER, first.counter!, now)
    expect(replay.valid).toBe(false)
    expect(replay.reason).toBe('replayed')
  })
})
