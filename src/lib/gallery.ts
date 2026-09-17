/**
 * Gallery vocabulary shared by the server module and the editor UI.
 *
 * It lives in `lib/` rather than in `server/modules/media/gallery.ts` for one
 * concrete reason: the record editor is a client component and needs
 * `isGalleryOwner` as a *value*, not a type. Importing it from the server
 * module pulled that module's whole dependency chain — the database client, the
 * authorization guard, and through it Argon2 — into the browser bundle, which
 * fails the build outright on a native binding that has no browser target.
 *
 * Nothing here may import from `@/server`. That is the entire point of the
 * file, and the reason it is three declarations rather than part of a larger
 * shared module.
 */

export const GALLERY_OWNERS = ['product', 'partner', 'event'] as const
export type GalleryOwner = (typeof GALLERY_OWNERS)[number]

export function isGalleryOwner(value: string): value is GalleryOwner {
  return (GALLERY_OWNERS as readonly string[]).includes(value)
}

/** One image in a gallery, as the editor renders it. */
export interface GalleryItem {
  id: string
  assetId: string
  role: string
  sortOrder: number
  name: string
  url: string
  thumbnailUrl: string | null
  alt: string | null
}
