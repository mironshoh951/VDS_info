/**
 * CSV, written out and read back.
 *
 * Hand-written rather than pulled from npm, for two reasons. The format is
 * small enough that a correct implementation is shorter than the argument
 * about which library to trust, and this project's dependency audit is a CI
 * gate — a parser is not worth a supply chain.
 *
 * It follows RFC 4180: fields containing a comma, a quote or a newline are
 * quoted, and a quote inside a quoted field is doubled. Both are essential
 * here, because a product description legitimately contains commas and a
 * multi-line list of benefits legitimately contains newlines.
 */

/** Excel reads a UTF-8 file as Latin-1 unless it finds this. */
const BOM = '﻿'

function encodeField(value: string): string {
  const needsQuotes = /[",\r\n]/.test(value)
  if (!needsQuotes) return value
  return `"${value.replaceAll('"', '""')}"`
}

/**
 * Serialises rows, first row included as-is — the caller decides whether it is
 * a header.
 *
 * The byte-order mark is deliberate: without it Excel renders Cyrillic and
 * Chinese as mojibake, and this catalogue is written in four languages, two of
 * which are not Latin.
 */
export function toCsv(rows: readonly (readonly string[])[]): string {
  const body = rows.map((row) => row.map(encodeField).join(',')).join('\r\n')
  return `${BOM}${body}\r\n`
}

/**
 * Parses CSV into rows of raw strings.
 *
 * A single pass with an explicit `inQuotes` flag, because the naive approach —
 * splitting on newlines and then on commas — corrupts exactly the rows that
 * matter: the ones with a description long enough to wrap.
 *
 * Unterminated quotes are not an error. A file truncated mid-field still
 * yields everything before the truncation, which is more useful to someone
 * fixing a spreadsheet than a parse failure with no line number.
 */
export function parseCsv(input: string): string[][] {
  const text = input.startsWith(BOM) ? input.slice(BOM.length) : input

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === ',') {
      row.push(field)
      field = ''
      continue
    }

    if (char === '\r' || char === '\n') {
      // Consume CRLF as one break rather than two empty rows.
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }

    field += char
  }

  // Whatever is still in hand belongs to a final row without a trailing
  // newline. A file ending in one leaves nothing here, which is why the guard
  // checks both.
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

/**
 * Parses into objects keyed by the header row.
 *
 * Rows that are entirely empty are dropped — spreadsheet exports routinely end
 * with a few of them, and treating those as records to import produces
 * confusing "the title is required" errors for rows the author never wrote.
 */
export function parseCsvRecords(input: string): Record<string, string>[] {
  const rows = parseCsv(input)
  if (rows.length === 0) return []

  const header = (rows[0] ?? []).map((cell) => cell.trim())

  return rows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row) => {
      const record: Record<string, string> = {}
      header.forEach((key, index) => {
        if (key.length > 0) record[key] = row[index] ?? ''
      })
      return record
    })
}
