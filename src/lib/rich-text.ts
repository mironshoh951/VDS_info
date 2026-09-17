import { z } from 'zod'

/**
 * Portable rich-text document format.
 *
 * Content is stored as a structured tree rather than an HTML string. Three
 * reasons this matters here:
 *
 *  - **Safety.** There is no HTML to sanitise on the way out; the renderer
 *    only ever emits the node types it knows about, so stored-XSS through the
 *    CMS is not possible by construction (§10.1).
 *  - **Translation.** The AI translator receives text nodes and returns text
 *    nodes; formatting, links and product codes survive untouched (§27).
 *  - **Portability.** The same document renders to HTML, to plain text for the
 *    search index, and to a chunk for the RAG pipeline.
 */

export const markSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bold') }),
  z.object({ type: z.literal('italic') }),
  z.object({ type: z.literal('underline') }),
  z.object({ type: z.literal('code') }),
  z.object({
    type: z.literal('link'),
    href: z.string(),
    target: z.enum(['_self', '_blank']).optional(),
  }),
])

export type Mark = z.infer<typeof markSchema>

export interface TextNode {
  type: 'text'
  text: string
  marks?: Mark[]
}

export interface ElementNode {
  type:
    | 'paragraph'
    | 'heading'
    | 'bulletList'
    | 'orderedList'
    | 'listItem'
    | 'blockquote'
    | 'hardBreak'
    | 'divider'
  level?: 2 | 3 | 4
  content?: RichTextNode[]
}

export type RichTextNode = TextNode | ElementNode

export interface RichTextDocument {
  type: 'doc'
  content: RichTextNode[]
}

const textNodeSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  marks: z.array(markSchema).optional(),
})

const elementNodeSchema: z.ZodType<ElementNode> = z.lazy(() =>
  z.object({
    type: z.enum([
      'paragraph',
      'heading',
      'bulletList',
      'orderedList',
      'listItem',
      'blockquote',
      'hardBreak',
      'divider',
    ]),
    level: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
    content: z.array(nodeSchema).optional(),
  }),
)

const nodeSchema: z.ZodType<RichTextNode> = z.lazy(() =>
  z.union([textNodeSchema, elementNodeSchema]),
)

export const richTextDocumentSchema: z.ZodType<RichTextDocument> = z.object({
  type: z.literal('doc'),
  content: z.array(nodeSchema),
})

export function parseRichText(value: unknown): RichTextDocument | null {
  if (value === null || value === undefined) return null
  const result = richTextDocumentSchema.safeParse(value)
  return result.success ? result.data : null
}

/** Creates a single-paragraph document — used by importers and seed data. */
export function plainTextDocument(text: string): RichTextDocument {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)

  return {
    type: 'doc',
    content: paragraphs.map((paragraph) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: paragraph }],
    })),
  }
}

/**
 * Flattens a document to plain text. This is what feeds the search index, the
 * RAG chunker, meta descriptions and reading-time estimation — one
 * implementation, so those four never disagree about what a page says.
 */
export function richTextToPlainText(document: unknown): string {
  const parsed = parseRichText(document)
  if (!parsed) return ''

  const parts: string[] = []

  const walk = (nodes: RichTextNode[]): void => {
    for (const node of nodes) {
      if (node.type === 'text') {
        parts.push(node.text)
        continue
      }
      if (node.type === 'hardBreak') {
        parts.push('\n')
        continue
      }
      if (node.content) walk(node.content)

      // Block-level nodes are separated by a blank line so that the flattened
      // text reads the way the document does — this text is what the search
      // index and the RAG chunker see.
      if (
        node.type === 'paragraph' ||
        node.type === 'heading' ||
        node.type === 'blockquote'
      ) {
        parts.push('\n\n')
      } else if (node.type === 'listItem') {
        parts.push('\n')
      }
    }
  }

  walk(parsed.content)

  return parts
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Average reading speed differs sharply for CJK; both are approximations. */
export function estimateReadingMinutes(document: unknown, locale: string): number {
  const text = richTextToPlainText(document)
  if (!text) return 0

  if (locale === 'zh') {
    const characters = text.replace(/\s+/g, '').length
    return Math.max(1, Math.round(characters / 400))
  }

  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 220))
}

/**
 * Link targets permitted in stored content. Anything else (javascript:, data:)
 * is rejected at save time and never rendered.
 */
export function isSafeHref(href: string): boolean {
  const trimmed = href.trim().toLowerCase()
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:')
  )
}
