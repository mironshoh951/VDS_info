/**
 * What each block type exposes to an editor.
 *
 * Blocks store free-form JSON, which is what lets a new block ship without a
 * migration — and also what would let the editor become a raw JSON textarea.
 * This file is the contract that stops that: it says, per type, which fields
 * exist, what kind each is, and — critically — which side of the locale split
 * it belongs on.
 *
 * That split is the whole reason the schema has two `props` columns.
 * `PageBlock.props` holds configuration that is the same in every language:
 * how many items to show, which page a button points at, the alignment.
 * `PageBlockTranslation.props` holds the words. Getting a field on the wrong
 * side is not a cosmetic mistake — a heading in the config column would be
 * written once and shown to every visitor in the wrong language.
 *
 * In `lib/` rather than `server/` because the editor is a client component and
 * needs these definitions as values. Nothing here may import from `@/server`.
 */

export type BlockFieldKind =
  | 'text'
  | 'textarea'
  | 'richText'
  | 'number'
  | 'select'
  | 'items'
  /** A single image from the media library, stored as an asset id. */
  | 'media'
  /** An ordered list of image ids. */
  | 'mediaList'

export interface BlockField {
  name: string
  kind: BlockFieldKind
  /** Localized text lives on the translation row; config does not. */
  localized: boolean
  options?: readonly string[]
  min?: number
  max?: number
  /** Sub-fields for `items`, which is a repeating list of small records. */
  itemFields?: readonly string[]
}

export interface BlockDefinition {
  type: string
  /** Blocks that pull their own rows from the database rather than from props. */
  dataDriven: boolean
  fields: readonly BlockField[]
}

const HEADING: BlockField = { name: 'heading', kind: 'text', localized: true }
const BODY: BlockField = { name: 'body', kind: 'textarea', localized: true }
const CTA_LABEL: BlockField = { name: 'ctaLabel', kind: 'text', localized: true }
const CTA_HREF: BlockField = { name: 'ctaHref', kind: 'text', localized: false }
const LIMIT = (max: number): BlockField => ({
  name: 'limit',
  kind: 'number',
  localized: false,
  min: 1,
  max,
})

export const BLOCK_DEFINITIONS: readonly BlockDefinition[] = [
  {
    type: 'hero',
    dataDriven: false,
    fields: [
      // --- The visual -------------------------------------------------------
      // All of it is configuration: a photograph of the showroom is the same
      // photograph in four languages.
      {
        name: 'visual',
        kind: 'select',
        localized: false,
        options: ['image', 'video', 'none'],
      },
      { name: 'imageId', kind: 'media', localized: false },
      // A separate portrait-friendly crop, because a wide showroom shot with
      // the subject at the left edge loses the subject entirely on a phone.
      { name: 'mobileImageId', kind: 'media', localized: false },
      { name: 'videoUrl', kind: 'text', localized: false },
      { name: 'posterId', kind: 'media', localized: false },
      // Percentages, so `object-position` can keep the important part of the
      // picture visible at any aspect ratio.
      { name: 'focalX', kind: 'number', localized: false, min: 0, max: 100 },
      { name: 'focalY', kind: 'number', localized: false, min: 0, max: 100 },

      // --- How it behaves ---------------------------------------------------
      // A preset, not a panel of sliders. It sets safe combinations of motion,
      // scrim and height; the two overrides below are the only ones that are
      // genuinely per-photograph.
      {
        name: 'preset',
        kind: 'select',
        localized: false,
        options: ['cinematic', 'editorial', 'minimal', 'static'],
      },
      { name: 'overlayStrength', kind: 'number', localized: false, min: 0, max: 100 },
      {
        name: 'height',
        kind: 'select',
        localized: false,
        options: ['full', 'tall', 'standard'],
      },

      // --- The words --------------------------------------------------------
      { name: 'eyebrow', kind: 'text', localized: true },
      HEADING,
      BODY,
      { name: 'primaryCtaLabel', kind: 'text', localized: true },
      { name: 'primaryCtaHref', kind: 'text', localized: false },
      { name: 'secondaryCtaLabel', kind: 'text', localized: true },
      { name: 'secondaryCtaHref', kind: 'text', localized: false },
      { name: 'align', kind: 'select', localized: false, options: ['left', 'center'] },
    ],
  },
  {
    type: 'statistics',
    dataDriven: false,
    fields: [
      HEADING,
      // Both the number and its caption are localized: "500+" is the same
      // everywhere, but "2 500" is written "2,500" in English, and the caption
      // beside it is a sentence.
      { name: 'items', kind: 'items', localized: true, itemFields: ['value', 'label'] },
    ],
  },
  {
    type: 'richText',
    dataDriven: false,
    fields: [HEADING, { name: 'body', kind: 'richText', localized: true }],
  },
  {
    type: 'cta',
    dataDriven: false,
    fields: [HEADING, BODY, CTA_LABEL, CTA_HREF],
  },
  {
    type: 'featuredCategories',
    dataDriven: true,
    fields: [HEADING, BODY, LIMIT(24)],
  },
  {
    type: 'featuredProducts',
    dataDriven: true,
    fields: [HEADING, CTA_LABEL, CTA_HREF, LIMIT(24)],
  },
  {
    type: 'servicesGrid',
    dataDriven: true,
    fields: [HEADING, CTA_LABEL, CTA_HREF, LIMIT(24)],
  },
  {
    type: 'featuredPartners',
    dataDriven: true,
    fields: [HEADING, BODY, CTA_LABEL, CTA_HREF, LIMIT(24)],
  },
  {
    type: 'brandLogos',
    dataDriven: true,
    fields: [HEADING, LIMIT(48)],
  },
  {
    type: 'latestNews',
    dataDriven: true,
    fields: [HEADING, CTA_LABEL, CTA_HREF, LIMIT(12)],
  },
  {
    // A strip of the company's own photographs — the premises, the team, an
    // installation. The catalogue blocks show what is sold; this is the only
    // block that shows who is selling it.
    type: 'gallery',
    dataDriven: false,
    fields: [
      HEADING,
      BODY,
      { name: 'imageIds', kind: 'mediaList', localized: false },
      {
        name: 'layout',
        kind: 'select',
        localized: false,
        options: ['mosaic', 'row'],
      },
    ],
  },
  {
    type: 'contact',
    dataDriven: true,
    fields: [
      HEADING,
      { name: 'officesHeading', kind: 'text', localized: true },
      { name: 'formKey', kind: 'text', localized: false },
    ],
  },
] as const

export const BLOCK_TYPES = BLOCK_DEFINITIONS.map((definition) => definition.type)

export function blockDefinition(type: string): BlockDefinition | null {
  return BLOCK_DEFINITIONS.find((definition) => definition.type === type) ?? null
}

export function isBlockType(value: string): boolean {
  return BLOCK_TYPES.includes(value)
}

/** One block as the editor sees it: config, plus every language's text. */
export interface EditorBlock {
  id: string
  type: string
  sortOrder: number
  enabled: boolean
  anchor: string | null
  config: Record<string, unknown>
  text: Record<string, Record<string, unknown>>
}
