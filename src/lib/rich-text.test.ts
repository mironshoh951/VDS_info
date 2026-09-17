import { describe, expect, it } from 'vitest'
import {
  parseRichText,
  plainTextDocument,
  richTextToPlainText,
  estimateReadingMinutes,
  isSafeHref,
} from './rich-text'

describe('rich text parsing', () => {
  it('accepts a well-formed document', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          level: 2,
          content: [{ type: 'text', text: 'Specifications' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Shade ' },
            { type: 'text', text: 'A2', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    }
    expect(parseRichText(doc)).not.toBeNull()
  })

  it('rejects an unknown node type rather than passing it through', () => {
    const doc = { type: 'doc', content: [{ type: 'script', content: [] }] }
    expect(parseRichText(doc)).toBeNull()
  })

  it('returns null for null and malformed input', () => {
    expect(parseRichText(null)).toBeNull()
    expect(parseRichText('<p>hi</p>')).toBeNull()
  })
})

describe('plain text extraction', () => {
  it('flattens nested content and preserves word boundaries', () => {
    const doc = plainTextDocument('First paragraph.\n\nSecond paragraph.')
    expect(richTextToPlainText(doc)).toBe('First paragraph.\n\nSecond paragraph.')
  })

  it('walks list structures', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'text', text: 'Biocompatible' }] },
            { type: 'listItem', content: [{ type: 'text', text: 'Radiopaque' }] },
          ],
        },
      ],
    }
    expect(richTextToPlainText(doc)).toContain('Biocompatible')
    expect(richTextToPlainText(doc)).toContain('Radiopaque')
  })
})

describe('reading time', () => {
  it('uses a character-based estimate for Chinese', () => {
    const doc = plainTextDocument('牙科'.repeat(400))
    expect(estimateReadingMinutes(doc, 'zh')).toBe(2)
  })

  it('uses a word-based estimate elsewhere', () => {
    const doc = plainTextDocument(Array.from({ length: 440 }, () => 'word').join(' '))
    expect(estimateReadingMinutes(doc, 'en')).toBe(2)
  })

  it('never reports zero minutes for non-empty content', () => {
    expect(estimateReadingMinutes(plainTextDocument('Hi.'), 'en')).toBe(1)
  })
})

describe('link safety', () => {
  it('permits ordinary destinations', () => {
    expect(isSafeHref('/en/products')).toBe(true)
    expect(isSafeHref('https://example.com')).toBe(true)
    expect(isSafeHref('mailto:info@example.com')).toBe(true)
  })

  it('rejects script and data URLs', () => {
    expect(isSafeHref('javascript:alert(1)')).toBe(false)
    expect(isSafeHref('  JavaScript:alert(1)')).toBe(false)
    expect(isSafeHref('data:text/html;base64,PHNjcmlwdD4=')).toBe(false)
  })
})
