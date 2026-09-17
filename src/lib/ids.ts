import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { customAlphabet } from 'nanoid'

/** URL-safe, unambiguous alphabet — no look-alike characters in references. */
const REFERENCE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const referenceId = customAlphabet(REFERENCE_ALPHABET, 8)

/** Human-quotable inquiry reference, e.g. "INQ-7K3M9PQD". */
export function newInquiryReference(): string {
  return `INQ-${referenceId()}`
}

/** Cryptographically random opaque token (base64url). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

/** Stable hash used for opaque tokens stored at rest. */
export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

/**
 * Salted, rotating hash for analytics identifiers. The daily salt component
 * means a visitor cannot be tracked across days and the value cannot be
 * reversed to an IP address (§37, §47).
 */
export function visitorHash(raw: string, dailySalt: string): string {
  return createHash('sha256')
    .update(`${dailySalt}:${raw}`, 'utf8')
    .digest('hex')
    .slice(0, 32)
}

/** Constant-time comparison for secrets of equal expected length. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) {
    // Still perform a comparison to keep timing uniform.
    timingSafeEqual(bufA, bufA)
    return false
  }
  return timingSafeEqual(bufA, bufB)
}

/** Content hash used for translation freshness and AI caching (§27, §29). */
export function contentHash(value: unknown): string {
  const normalized = typeof value === 'string' ? value : JSON.stringify(value ?? null)
  return createHash('sha256').update(normalized, 'utf8').digest('hex')
}
