import { describe, expect, it } from 'vitest'
import { BLOCK_DEFINITIONS, BLOCK_TYPES, blockDefinition, isBlockType } from './blocks'

/**
 * These guard the two mistakes this file exists to prevent: a block the editor
 * offers that the renderer cannot draw, and a field on the wrong side of the
 * locale split. Both fail silently in a browser — the first as a blank section,
 * the second as one language's text shown to everyone.
 */
describe('block definitions', () => {
  it('has no duplicate types', () => {
    expect(new Set(BLOCK_TYPES).size).toBe(BLOCK_TYPES.length)
  })

  it('names every field exactly once per block', () => {
    for (const definition of BLOCK_DEFINITIONS) {
      const names = definition.fields.map((field) => field.name)
      expect(new Set(names).size, `${definition.type} has a repeated field`).toBe(
        names.length,
      )
    }
  })

  it('keeps text localized and configuration shared', () => {
    // A heading that is not localized would be written once and shown to every
    // visitor in the wrong language; a limit that *is* localized would let the
    // four languages disagree about how many products a page shows.
    const mustBeLocalized = ['heading', 'body', 'eyebrow', 'ctaLabel', 'items']
    const mustBeShared = ['limit', 'align', 'ctaHref', 'formKey']

    for (const definition of BLOCK_DEFINITIONS) {
      for (const field of definition.fields) {
        if (mustBeLocalized.includes(field.name)) {
          expect(field.localized, `${definition.type}.${field.name}`).toBe(true)
        }
        if (mustBeShared.includes(field.name)) {
          expect(field.localized, `${definition.type}.${field.name}`).toBe(false)
        }
      }
    }
  })

  it('gives every select its options and every items field its sub-fields', () => {
    for (const definition of BLOCK_DEFINITIONS) {
      for (const field of definition.fields) {
        if (field.kind === 'select') {
          expect(
            field.options?.length,
            `${definition.type}.${field.name}`,
          ).toBeGreaterThan(0)
        }
        if (field.kind === 'items') {
          expect(
            field.itemFields?.length,
            `${definition.type}.${field.name}`,
          ).toBeGreaterThan(0)
        }
      }
    }
  })

  it('resolves known types and rejects unknown ones', () => {
    expect(blockDefinition('hero')?.type).toBe('hero')
    expect(blockDefinition('nope')).toBeNull()
    expect(isBlockType('cta')).toBe(true)
    expect(isBlockType('cta ')).toBe(false)
  })
})
