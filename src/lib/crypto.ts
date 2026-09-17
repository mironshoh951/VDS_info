import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'
import { getEnv } from '@/lib/env'

/**
 * Authenticated encryption for secrets stored in the database — TOTP seeds and
 * provider API keys entered through the admin UI.
 *
 * AES-256-GCM with a random IV per value and the ciphertext authenticated by
 * its tag: a tampered row fails to decrypt rather than yielding altered data.
 * The key never leaves the environment.
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16
const VERSION = 'v1'

function key(): Buffer {
  // Accept either a 32-byte base64 key or a longer passphrase, normalised to
  // 32 bytes by SHA-256 so misconfiguration cannot silently weaken the cipher.
  const raw = getEnv().ENCRYPTION_KEY
  const decoded = Buffer.from(raw, 'base64')
  if (decoded.length === 32) return decoded
  return createHash('sha256').update(raw, 'utf8').digest()
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    VERSION,
    iv.toString('base64url'),
    encrypted.toString('base64url'),
    tag.toString('base64url'),
  ].join('.')
}

export function decryptSecret(payload: string): string {
  const parts = payload.split('.')
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Unrecognised encrypted payload format')
  }
  const iv = Buffer.from(parts[1] as string, 'base64url')
  const encrypted = Buffer.from(parts[2] as string, 'base64url')
  const tag = Buffer.from(parts[3] as string, 'base64url')

  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new Error('Malformed encrypted payload')
  }

  const decipher = createDecipheriv(ALGORITHM, key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

/** Masks a secret for display, never revealing more than the last 4 characters. */
export function maskSecret(value: string): string {
  if (value.length <= 4) return '••••'
  return `${'•'.repeat(Math.min(value.length - 4, 24))}${value.slice(-4)}`
}
