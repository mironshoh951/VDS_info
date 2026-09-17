import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { randomBytes } from 'node:crypto'
import { getEnv } from '@/lib/env'

/**
 * Object storage for uploaded media.
 *
 * One narrow interface with a local-filesystem implementation. Everything
 * above this file addresses objects by storage key and never by path, so
 * moving to S3 later is a new class here and no change anywhere else — which
 * is also why the deployed driver is already named in the environment.
 */

export interface MediaStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>
  get(key: string): Promise<Buffer>
  remove(key: string): Promise<void>
  /** Where a browser fetches this object. */
  urlFor(key: string): string
}

/**
 * Extension is derived from the declared type, never from the uploaded
 * filename: a name like "photo.jpg.svg" must not decide how the file is
 * stored or later served.
 */
const EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'text/csv': 'csv',
}

export function extensionFor(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? 'bin'
}

/**
 * Builds a fresh, unguessable key. Dated folders keep any single directory
 * small enough to list; the random stem means one upload can neither overwrite
 * another nor be found by guessing a filename.
 */
export function newStorageKey(mimeType: string, suffix?: string): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const stem = randomBytes(16).toString('hex')
  const tail = suffix ? `-${suffix}` : ''
  return `${year}/${month}/${stem}${tail}.${extensionFor(mimeType)}`
}

/** Keys are generated, but this is still enforced — defence in depth. */
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9/_-]*\.[A-Za-z0-9]+$/

export function isSafeStorageKey(key: string): boolean {
  return SAFE_KEY.test(key) && !key.includes('..')
}

class LocalMediaStorage implements MediaStorage {
  private readonly root: string

  constructor(dir: string) {
    this.root = resolve(process.cwd(), dir)
  }

  /**
   * Resolves a key and refuses anything that escapes the root, so a key that
   * ever reached this layer from outside cannot read or write elsewhere.
   */
  private absolute(key: string): string {
    if (!isSafeStorageKey(key)) throw new Error('Unsafe storage key')
    const full = resolve(this.root, key)
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error('Storage key escapes the media root')
    }
    return full
  }

  async put(key: string, body: Buffer): Promise<void> {
    const full = this.absolute(key)
    await mkdir(dirname(full), { recursive: true })
    await writeFile(full, body)
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.absolute(key))
  }

  async remove(key: string): Promise<void> {
    await rm(this.absolute(key), { force: true })
  }

  urlFor(key: string): string {
    return `/media/${key}`
  }
}

let cached: MediaStorage | null = null

export function mediaStorage(): MediaStorage {
  if (cached) return cached
  const env = getEnv()

  if (env.MEDIA_DRIVER === 's3') {
    // Deliberately explicit rather than a silent fallback: a deployment that
    // asks for S3 and quietly writes to a container's disk loses every upload
    // on the next restart.
    throw new Error(
      'MEDIA_DRIVER=s3 is configured but the S3 driver is not implemented yet. ' +
        'Set MEDIA_DRIVER=local, or add the driver in src/server/media/storage.ts.',
    )
  }

  cached = new LocalMediaStorage(env.MEDIA_LOCAL_DIR)
  return cached
}
