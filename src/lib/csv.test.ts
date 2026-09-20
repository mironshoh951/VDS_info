import { describe, expect, it } from 'vitest'
import { toCsv, parseCsv, parseCsvRecords } from './csv'

describe('toCsv', () => {
  it('leaves ordinary values unquoted', () => {
    expect(toCsv([['sku', 'name']])).toBe('﻿sku,name\r\n')
  })

  it('quotes the three characters that would otherwise break a row', () => {
    const csv = toCsv([['a,b', 'say "hi"', 'line1\nline2']])
    expect(csv).toContain('"a,b"')
    expect(csv).toContain('"say ""hi"""')
    expect(csv).toContain('"line1\nline2"')
  })

  it('starts with a byte-order mark so Excel reads UTF-8', () => {
    expect(toCsv([['Ürün', '产品']]).startsWith('﻿')).toBe(true)
  })
})

describe('parseCsv', () => {
  it('round-trips every value that needed quoting', () => {
    const rows = [
      ['sku', 'name', 'benefits'],
      ['A-1', 'Composite, universal', 'Fast\nDurable'],
      ['A-2', 'Says "premium"', ''],
    ]
    expect(parseCsv(toCsv(rows))).toEqual(rows)
  })

  it('reads a file written with plain newlines', () => {
    expect(parseCsv('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('does not turn a CRLF into an empty row', () => {
    expect(parseCsv('a,b\r\nc,d\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('keeps an empty trailing field', () => {
    expect(parseCsv('a,b,')).toEqual([['a', 'b', '']])
  })

  it('returns what it has when a quote is never closed', () => {
    // A truncated download should still show the editor their first rows.
    expect(parseCsv('a,b\n"unterminated')).toEqual([['a', 'b'], ['unterminated']])
  })

  it('treats an empty document as no rows at all', () => {
    expect(parseCsv('')).toEqual([])
  })
})

describe('parseCsvRecords', () => {
  it('keys each row by the header', () => {
    expect(parseCsvRecords('sku,name\r\nA-1,Composite\r\n')).toEqual([
      { sku: 'A-1', name: 'Composite' },
    ])
  })

  it('drops the blank rows spreadsheets leave at the end', () => {
    expect(parseCsvRecords('sku,name\r\nA-1,Composite\r\n,\r\n,\r\n')).toHaveLength(1)
  })

  it('fills in missing trailing columns rather than dropping the row', () => {
    expect(parseCsvRecords('sku,name,unit\r\nA-1,Composite\r\n')).toEqual([
      { sku: 'A-1', name: 'Composite', unit: '' },
    ])
  })

  it('ignores a column with no header, having nothing to call it', () => {
    expect(parseCsvRecords('sku,,name\r\nA-1,junk,Composite\r\n')).toEqual([
      { sku: 'A-1', name: 'Composite' },
    ])
  })
})
