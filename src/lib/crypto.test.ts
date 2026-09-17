import { beforeAll, describe, expect, it } from 'vitest'
import { encryptSecret, decryptSecret, maskSecret } from './crypto'

beforeAll(() => {
  Reflect.set(process.env, 'ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'))
})

describe('secret encryption', () => {
  it('round-trips a value', () => {
    const secret = 'JBSWY3DPEHPK3PXP'
    expect(decryptSecret(encryptSecret(secret))).toBe(secret)
  })

  it('produces a different ciphertext each time (random IV)', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'))
  })

  it('rejects a tampered payload rather than returning altered data', () => {
    const payload = encryptSecret('sensitive')
    const parts = payload.split('.')
    const tamperedBody = Buffer.from(parts[2]!, 'base64url')
    tamperedBody[0] = (tamperedBody[0]! ^ 0xff) & 0xff
    const tampered = [
      parts[0],
      parts[1],
      tamperedBody.toString('base64url'),
      parts[3],
    ].join('.')
    expect(() => decryptSecret(tampered)).toThrow()
  })

  it('rejects an unknown format', () => {
    expect(() => decryptSecret('v9.a.b.c')).toThrow(/Unrecognised/)
  })

  it('masks all but the last four characters', () => {
    expect(maskSecret('sk-abcdef123456')).toMatch(/3456$/)
    expect(maskSecret('sk-abcdef123456')).not.toContain('abcdef')
  })
})
