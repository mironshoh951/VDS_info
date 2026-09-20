import { describe, expect, it } from 'vitest'
import { parseRows } from './transfer'
import { toCsv } from '@/lib/csv'

/**
 * The import parser is the part worth testing without a database: everything
 * after it is `saveRecord`, which the editor already exercises. What matters
 * here is that a spreadsheet becomes exactly the fields the author filled in —
 * no more, because an invented empty field would wipe stored content.
 */

describe('parseRows from CSV', () => {
  const csv = (rows: string[][]) => toCsv(rows)

  it('splits base columns from per-language ones', () => {
    const rows = parseRows(
      'product',
      'csv',
      csv([
        ['slug', 'sku', 'uz.name', 'ru.name'],
        ['composite-a2', 'SKU-1', 'Kompozit A2', 'Композит A2'],
      ]),
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]?.base).toEqual({ slug: 'composite-a2', sku: 'SKU-1' })
    expect(rows[0]?.translations.uz).toEqual({ name: 'Kompozit A2' })
    expect(rows[0]?.translations.ru).toEqual({ name: 'Композит A2' })
  })

  it('omits columns the file does not have, rather than nulling them', () => {
    // This is the whole contract of a partial import: a two-column file must
    // not carry an instruction to blank out the other fifty.
    const rows = parseRows(
      'product',
      'csv',
      csv([
        ['slug', 'uz.name'],
        ['a', 'A'],
      ]),
    )

    expect(rows[0]?.base).not.toHaveProperty('sku')
    expect(rows[0]?.translations.uz).not.toHaveProperty('shortDescription')
    expect(rows[0]?.translations).not.toHaveProperty('zh')
  })

  it('numbers rows the way a spreadsheet does, header first', () => {
    const rows = parseRows('product', 'csv', csv([['slug'], ['first'], ['second']]))
    expect(rows.map((row) => row.line)).toEqual([2, 3])
  })

  it('reads a multi-line cell as a list', () => {
    const rows = parseRows(
      'product',
      'csv',
      csv([
        ['slug', 'uz.benefits'],
        ['a', 'Tez\nMustahkam'],
      ]),
    )
    expect(rows[0]?.translations.uz?.benefits).toEqual(['Tez', 'Mustahkam'])
  })

  it('reads the words a spreadsheet writes for a checkbox', () => {
    const rows = parseRows(
      'product',
      'csv',
      csv([
        ['slug', 'featured', 'isNew'],
        ['a', 'true', 'no'],
      ]),
    )
    expect(rows[0]?.base.featured).toBe(true)
    expect(rows[0]?.base.isNew).toBe(false)
  })

  it('ignores a column nobody declared', () => {
    const rows = parseRows(
      'product',
      'csv',
      csv([
        ['slug', 'my notes'],
        ['a', 'ask Dilshod'],
      ]),
    )
    expect(rows[0]?.base).toEqual({ slug: 'a' })
  })

  it('keeps an id so the row updates rather than duplicates', () => {
    const rows = parseRows(
      'product',
      'csv',
      csv([
        ['id', 'slug'],
        ['11111111-1111-1111-1111-111111111111', 'a'],
      ]),
    )
    expect(rows[0]?.id).toBe('11111111-1111-1111-1111-111111111111')
  })

  it('treats a blank id cell as "no id"', () => {
    const rows = parseRows(
      'product',
      'csv',
      csv([
        ['id', 'slug'],
        ['', 'a'],
      ]),
    )
    expect(rows[0]?.id).toBeNull()
  })
})

describe('parseRows from JSON', () => {
  it('reads the nested shape the JSON export writes', () => {
    const rows = parseRows(
      'product',
      'json',
      JSON.stringify([
        {
          id: null,
          base: { slug: 'composite-a2', featured: true },
          translations: { uz: { name: 'Kompozit A2' } },
        },
      ]),
    )

    expect(rows[0]?.base).toEqual({ slug: 'composite-a2', featured: true })
    expect(rows[0]?.translations.uz).toEqual({ name: 'Kompozit A2' })
  })

  it('accepts flat keys too, so a hand-written file is not refused', () => {
    const rows = parseRows(
      'product',
      'json',
      JSON.stringify([{ slug: 'a', 'uz.name': 'A' }]),
    )
    expect(rows[0]?.base.slug).toBe('a')
    expect(rows[0]?.translations.uz?.name).toBe('A')
  })

  it('refuses a document that is not an array of records', () => {
    expect(() => parseRows('product', 'json', '{"slug":"a"}')).toThrow()
    expect(() => parseRows('product', 'json', 'not json')).toThrow()
  })
})
