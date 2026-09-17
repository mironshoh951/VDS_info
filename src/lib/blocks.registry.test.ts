import { describe, expect, it } from 'vitest'
import { BLOCK_TYPES } from './blocks'
import { REGISTERED_BLOCK_TYPES } from '@/components/blocks/registry'

/**
 * The editor's list and the renderer's list have to be the same list.
 *
 * They are declared separately on purpose — the renderer holds components, the
 * editor holds field definitions — and that separation is what lets them drift.
 * A type in one and not the other is either a section an editor can add that
 * renders as nothing, or a section on a live page that the editor refuses to
 * open.
 */
describe('block registry', () => {
  it('offers exactly the types the renderer can draw', () => {
    expect([...BLOCK_TYPES].sort()).toEqual([...REGISTERED_BLOCK_TYPES].sort())
  })
})
