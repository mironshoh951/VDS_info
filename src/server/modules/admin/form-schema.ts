import type { ResourceKey } from './resources'

/**
 * What each content type exposes in the editor.
 *
 * Declaring the fields as data means the editor, its validation and its
 * per-locale tabs are one implementation rather than ten forms — and adding a
 * field to a content type is one line here, not a new screen.
 *
 * Fields are split by where they live: `base` columns are
 * language-independent (codes, dates, relations, flags) and `translated`
 * fields live on the translation row, one set per locale.
 */

export type FieldKind =
  | 'text'
  | 'slug'
  | 'textarea'
  | 'richtext'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'stringList'
  | 'media'

export interface FieldSpec {
  name: string
  label: string
  kind: FieldKind
  help?: string
  required?: boolean
  options?: Array<{ value: string; label: string }>
  /** For `media` fields: which part of the library the picker offers. */
  accept?: 'image' | 'document'
  /** Width hint for the two-column editor grid. */
  span?: 1 | 2
}

export interface ResourceFormSchema {
  base: FieldSpec[]
  translated: FieldSpec[]
  /** Column on the translation row that holds the primary name. */
  titleField: string
}

const COUNTRY_HELP = 'Two-letter ISO code, e.g. DE, KR, UZ.'

export const FORM_SCHEMAS: Record<ResourceKey, ResourceFormSchema> = {
  product: {
    titleField: 'name',
    base: [
      {
        name: 'slug',
        label: 'Slug',
        kind: 'slug',
        required: true,
        help: 'Used in the URL.',
      },
      { name: 'sku', label: 'SKU', kind: 'text' },
      { name: 'productCode', label: 'Product code', kind: 'text' },
      { name: 'manufacturer', label: 'Manufacturer', kind: 'text' },
      {
        name: 'countryOfOrigin',
        label: 'Country of origin',
        kind: 'text',
        help: COUNTRY_HELP,
      },
      { name: 'unit', label: 'Unit', kind: 'text', help: 'e.g. syringe, box, piece.' },
      { name: 'packaging', label: 'Packaging', kind: 'text' },
      { name: 'featured', label: 'Featured', kind: 'boolean' },
      { name: 'isNew', label: 'Mark as new', kind: 'boolean' },
    ],
    translated: [
      { name: 'name', label: 'Name', kind: 'text', required: true, span: 2 },
      { name: 'shortDescription', label: 'Short description', kind: 'textarea', span: 2 },
      { name: 'description', label: 'Description', kind: 'richtext', span: 2 },
      {
        name: 'benefits',
        label: 'Key benefits',
        kind: 'stringList',
        span: 2,
        help: 'One per line.',
      },
      {
        name: 'applications',
        label: 'Applications',
        kind: 'stringList',
        span: 2,
        help: 'One per line.',
      },
      {
        name: 'indications',
        label: 'Indications',
        kind: 'stringList',
        span: 2,
        help: 'One per line.',
      },
      { name: 'compatibility', label: 'Compatibility', kind: 'textarea', span: 2 },
    ],
  },

  partner: {
    titleField: 'name',
    base: [
      { name: 'logoId', label: 'Logo', kind: 'media', accept: 'image' },
      { name: 'coverId', label: 'Cover image', kind: 'media', accept: 'image' },
      { name: 'slug', label: 'Slug', kind: 'slug', required: true },
      { name: 'displayName', label: 'Display name', kind: 'text', required: true },
      { name: 'legalName', label: 'Legal name', kind: 'text' },
      {
        name: 'partnershipType',
        label: 'Partnership type',
        kind: 'select',
        options: [
          { value: 'MANUFACTURER', label: 'Manufacturer' },
          { value: 'DISTRIBUTOR', label: 'Distributor' },
          { value: 'TECHNOLOGY', label: 'Technology partner' },
          { value: 'STRATEGIC', label: 'Strategic partner' },
          { value: 'EDUCATION', label: 'Education partner' },
          { value: 'SERVICE', label: 'Service partner' },
          { value: 'LOGISTICS', label: 'Logistics partner' },
          { value: 'OTHER', label: 'Other' },
        ],
      },
      { name: 'countryCode', label: 'Country', kind: 'text', help: COUNTRY_HELP },
      { name: 'city', label: 'City', kind: 'text' },
      { name: 'website', label: 'Website', kind: 'text' },
      { name: 'email', label: 'Email', kind: 'text' },
      { name: 'phone', label: 'Phone', kind: 'text' },
      { name: 'foundedYear', label: 'Founded', kind: 'number' },
      {
        name: 'verified',
        label: 'Verified partner',
        kind: 'boolean',
        help: 'Set this only when the relationship has been confirmed internally.',
      },
      { name: 'featured', label: 'Featured', kind: 'boolean' },
    ],
    translated: [
      { name: 'name', label: 'Name', kind: 'text', required: true, span: 2 },
      { name: 'shortDescription', label: 'Short description', kind: 'textarea', span: 2 },
      { name: 'specialization', label: 'Specialization', kind: 'text', span: 2 },
      { name: 'description', label: 'Profile', kind: 'richtext', span: 2 },
      {
        name: 'highlights',
        label: 'Highlights',
        kind: 'stringList',
        span: 2,
        help: 'One per line.',
      },
    ],
  },

  brand: {
    titleField: 'name',
    base: [
      { name: 'logoId', label: 'Logo', kind: 'media', accept: 'image' },
      { name: 'coverId', label: 'Cover image', kind: 'media', accept: 'image' },
      { name: 'slug', label: 'Slug', kind: 'slug', required: true },
      { name: 'name', label: 'Brand name', kind: 'text', required: true },
      {
        name: 'countryCode',
        label: 'Country of origin',
        kind: 'text',
        help: COUNTRY_HELP,
      },
      { name: 'website', label: 'Website', kind: 'text' },
      { name: 'foundedYear', label: 'Founded', kind: 'number' },
      { name: 'featured', label: 'Featured', kind: 'boolean' },
    ],
    translated: [
      { name: 'name', label: 'Name', kind: 'text', required: true, span: 2 },
      { name: 'tagline', label: 'Tagline', kind: 'text', span: 2 },
      { name: 'shortDescription', label: 'Short description', kind: 'textarea', span: 2 },
      { name: 'description', label: 'Description', kind: 'richtext', span: 2 },
    ],
  },

  service: {
    titleField: 'name',
    base: [
      { name: 'iconId', label: 'Icon', kind: 'media', accept: 'image' },
      { name: 'coverId', label: 'Cover image', kind: 'media', accept: 'image' },
      { name: 'slug', label: 'Slug', kind: 'slug', required: true },
      { name: 'iconKey', label: 'Icon key', kind: 'text' },
      { name: 'featured', label: 'Featured', kind: 'boolean' },
      { name: 'sortOrder', label: 'Order', kind: 'number' },
    ],
    translated: [
      { name: 'name', label: 'Name', kind: 'text', required: true, span: 2 },
      { name: 'shortDescription', label: 'Short description', kind: 'textarea', span: 2 },
      { name: 'description', label: 'Description', kind: 'richtext', span: 2 },
      { name: 'benefits', label: 'What the client gets', kind: 'stringList', span: 2 },
      { name: 'ctaLabel', label: 'Call-to-action label', kind: 'text' },
    ],
  },

  event: {
    titleField: 'title',
    base: [
      { name: 'coverId', label: 'Cover image', kind: 'media', accept: 'image' },
      { name: 'slug', label: 'Slug', kind: 'slug', required: true },
      {
        name: 'type',
        label: 'Event type',
        kind: 'select',
        options: [
          { value: 'CONFERENCE', label: 'Conference' },
          { value: 'EXHIBITION', label: 'Exhibition' },
          { value: 'SEMINAR', label: 'Seminar' },
          { value: 'WORKSHOP', label: 'Workshop' },
          { value: 'TRAINING', label: 'Training' },
          { value: 'WEBINAR', label: 'Webinar' },
          { value: 'OTHER', label: 'Other' },
        ],
      },
      {
        name: 'participation',
        label: 'Our role',
        kind: 'select',
        options: [
          { value: 'EXHIBITOR', label: 'Exhibitor' },
          { value: 'VISITOR', label: 'Visitor' },
          { value: 'SPEAKER', label: 'Speaker' },
          { value: 'SPONSOR', label: 'Sponsor' },
          { value: 'ORGANIZER', label: 'Organizer' },
          { value: 'PARTNER', label: 'Partner' },
        ],
      },
      { name: 'startDate', label: 'Starts', kind: 'date', required: true },
      { name: 'endDate', label: 'Ends', kind: 'date' },
      { name: 'countryCode', label: 'Country', kind: 'text', help: COUNTRY_HELP },
      { name: 'city', label: 'City', kind: 'text' },
      { name: 'venue', label: 'Venue', kind: 'text' },
      { name: 'boothNumber', label: 'Booth', kind: 'text' },
      { name: 'organizer', label: 'Organizer', kind: 'text' },
      { name: 'website', label: 'Event website', kind: 'text' },
      { name: 'featured', label: 'Featured', kind: 'boolean' },
    ],
    translated: [
      { name: 'title', label: 'Title', kind: 'text', required: true, span: 2 },
      { name: 'shortDescription', label: 'Short description', kind: 'textarea', span: 2 },
      { name: 'description', label: 'Description', kind: 'richtext', span: 2 },
      { name: 'summary', label: 'Post-event summary', kind: 'richtext', span: 2 },
    ],
  },

  article: {
    titleField: 'title',
    base: [
      { name: 'coverId', label: 'Cover image', kind: 'media', accept: 'image' },
      { name: 'slug', label: 'Slug', kind: 'slug', required: true },
      { name: 'authorName', label: 'Author', kind: 'text' },
      { name: 'featured', label: 'Featured', kind: 'boolean' },
    ],
    translated: [
      { name: 'title', label: 'Title', kind: 'text', required: true, span: 2 },
      { name: 'excerpt', label: 'Excerpt', kind: 'textarea', span: 2 },
      { name: 'content', label: 'Article', kind: 'richtext', span: 2 },
    ],
  },

  resource: {
    titleField: 'title',
    base: [
      { name: 'fileId', label: 'File', kind: 'media', accept: 'document' },
      { name: 'thumbnailId', label: 'Thumbnail', kind: 'media', accept: 'image' },
      { name: 'slug', label: 'Slug', kind: 'slug', required: true },
      {
        name: 'type',
        label: 'Document type',
        kind: 'select',
        options: [
          { value: 'PDF', label: 'PDF' },
          { value: 'BROCHURE', label: 'Brochure' },
          { value: 'CATALOG', label: 'Catalogue' },
          { value: 'MANUAL', label: 'Manual' },
          { value: 'CERTIFICATE', label: 'Certificate' },
          { value: 'PRESENTATION', label: 'Presentation' },
          { value: 'COMPANY_PROFILE', label: 'Company profile' },
          { value: 'TECHNICAL_DOCUMENT', label: 'Technical document' },
          { value: 'VIDEO', label: 'Video' },
          { value: 'IMAGE', label: 'Image' },
        ],
      },
      { name: 'contentLocale', label: 'Document language', kind: 'text' },
      { name: 'externalUrl', label: 'External link', kind: 'text' },
      { name: 'featured', label: 'Featured', kind: 'boolean' },
    ],
    translated: [
      { name: 'title', label: 'Title', kind: 'text', required: true, span: 2 },
      { name: 'description', label: 'Description', kind: 'textarea', span: 2 },
    ],
  },

  certificate: {
    titleField: 'title',
    base: [
      { name: 'fileId', label: 'File', kind: 'media', accept: 'document' },
      { name: 'thumbnailId', label: 'Thumbnail', kind: 'media', accept: 'image' },
      { name: 'slug', label: 'Slug', kind: 'slug', required: true },
      {
        name: 'kind',
        label: 'Document class',
        kind: 'text',
        help: 'e.g. ISO, CE, LICENCE.',
      },
      { name: 'issuer', label: 'Issued by', kind: 'text' },
      { name: 'referenceNo', label: 'Reference number', kind: 'text' },
      { name: 'issuedOn', label: 'Issued on', kind: 'date' },
      { name: 'expiresOn', label: 'Valid until', kind: 'date' },
      { name: 'featured', label: 'Featured', kind: 'boolean' },
    ],
    translated: [
      { name: 'title', label: 'Title', kind: 'text', required: true, span: 2 },
      { name: 'description', label: 'Description', kind: 'textarea', span: 2 },
      { name: 'issuerLocalized', label: 'Issuer (localized)', kind: 'text', span: 2 },
    ],
  },

  achievement: {
    titleField: 'title',
    base: [
      { name: 'imageId', label: 'Image', kind: 'media', accept: 'image' },
      { name: 'documentId', label: 'Document', kind: 'media', accept: 'document' },
      { name: 'slug', label: 'Slug', kind: 'slug', required: true },
      {
        name: 'category',
        label: 'Category',
        kind: 'select',
        options: [
          { value: 'AWARD', label: 'Award' },
          { value: 'CERTIFICATION', label: 'Certification' },
          { value: 'MILESTONE', label: 'Milestone' },
          { value: 'PARTNERSHIP', label: 'Partnership' },
          { value: 'BUSINESS', label: 'Business' },
          { value: 'RECOGNITION', label: 'Recognition' },
        ],
      },
      { name: 'achievedOn', label: 'Date', kind: 'date' },
      { name: 'location', label: 'Location', kind: 'text' },
      { name: 'externalUrl', label: 'Read more link', kind: 'text' },
      { name: 'featured', label: 'Featured', kind: 'boolean' },
    ],
    translated: [
      { name: 'title', label: 'Title', kind: 'text', required: true, span: 2 },
      { name: 'issuer', label: 'Awarded by', kind: 'text', span: 2 },
      { name: 'description', label: 'Description', kind: 'richtext', span: 2 },
    ],
  },

  page: {
    titleField: 'title',
    base: [
      { name: 'slug', label: 'Slug', kind: 'slug', required: true },
      { name: 'template', label: 'Template', kind: 'text' },
      { name: 'showInSitemap', label: 'Include in sitemap', kind: 'boolean' },
      { name: 'sortOrder', label: 'Order', kind: 'number' },
    ],
    translated: [
      { name: 'title', label: 'Title', kind: 'text', required: true, span: 2 },
      { name: 'subtitle', label: 'Subtitle', kind: 'text', span: 2 },
      { name: 'summary', label: 'Summary', kind: 'textarea', span: 2 },
      {
        name: 'slug',
        label: 'Localized slug',
        kind: 'slug',
        span: 2,
        help: 'Optional. Falls back to the main slug.',
      },
    ],
  },
}
