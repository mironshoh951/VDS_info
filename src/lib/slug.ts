/**
 * Slug generation that behaves correctly for the four launch languages.
 *
 * Latin and Cyrillic are transliterated; CJK text has no meaningful Latin
 * transliteration, so a Chinese title yields a short hashed suffix instead of
 * an empty slug. The caller is always free to override the generated value —
 * the CMS exposes the slug as an editable field.
 */

const CYRILLIC_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  // Uzbek Cyrillic additions
  ў: 'o',
  қ: 'q',
  ғ: 'g',
  ҳ: 'h',
}

const UZBEK_LATIN_MAP: Record<string, string> = {
  oʻ: 'o',
  gʻ: 'g',
  'o‘': 'o',
  'g‘': 'g',
  "o'": 'o',
  "g'": 'g',
}

function transliterate(input: string): string {
  let out = input.toLowerCase()
  for (const [from, to] of Object.entries(UZBEK_LATIN_MAP)) {
    out = out.split(from).join(to)
  }
  return out
    .split('')
    .map((ch) => CYRILLIC_MAP[ch] ?? ch)
    .join('')
}

const CJK_RANGE = /[㐀-䶿一-鿿豈-﫿぀-ヿ가-힯]/

export function slugify(input: string, options: { maxLength?: number } = {}): string {
  const maxLength = options.maxLength ?? 80
  const transliterated = transliterate(input)

  const base = transliterated
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLength)
    .replace(/-$/, '')

  if (base.length > 0) return base

  // Nothing survived transliteration (e.g. a purely Chinese title).
  if (CJK_RANGE.test(input)) {
    return `p-${simpleHash(input)}`
  }
  return `item-${simpleHash(input)}`
}

function simpleHash(value: string): string {
  let h = 5381
  for (let i = 0; i < value.length; i += 1) {
    h = ((h << 5) + h + value.charCodeAt(i)) >>> 0
  }
  return h.toString(36)
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 120
}

/**
 * Appends an incrementing suffix until the candidate is unique. `exists` is
 * supplied by the caller so this stays a pure function of its inputs.
 */
export async function uniqueSlug(
  desired: string,
  exists: (candidate: string) => Promise<boolean>,
  maxAttempts = 50,
): Promise<string> {
  const base = slugify(desired)
  if (!(await exists(base))) return base

  for (let i = 2; i <= maxAttempts; i += 1) {
    const candidate = `${base}-${i}`
    if (!(await exists(candidate))) return candidate
  }
  return `${base}-${Date.now().toString(36)}`
}
