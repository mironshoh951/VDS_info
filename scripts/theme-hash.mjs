/**
 * Recomputes the CSP hash for the public theme bootstrap script.
 *
 * Run after editing THEME_INIT_SCRIPT in src/lib/site-theme.ts:
 *   npm run theme:hash
 *
 * The unit test asserts the two agree, so a forgotten run fails in CI rather
 * than silently in a browser, where the only symptom is a site stuck on light.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const FILE = 'src/lib/site-theme.ts'

const source = readFileSync(FILE, 'utf8')

const match = source.match(/export const THEME_INIT_SCRIPT =\s*\n\s*"((?:[^"\\]|\\.)*)"/)
if (!match) {
  console.error(`Could not find THEME_INIT_SCRIPT in ${FILE}.`)
  process.exit(1)
}

// The literal is TypeScript source, so unescape it the way the compiler would
// before hashing — the browser sees the decoded string, not the escaped one.
const script = JSON.parse(`"${match[1]}"`)
const hash = createHash('sha256').update(script, 'utf8').digest('base64')
const replacement = `export const THEME_INIT_SCRIPT_HASH = "'sha256-${hash}'"`

const hashPattern = /export const THEME_INIT_SCRIPT_HASH =\s*"[^"]*"/
if (!hashPattern.test(source)) {
  console.error(`Could not find THEME_INIT_SCRIPT_HASH in ${FILE}.`)
  process.exit(1)
}

if (source.includes(replacement.replace('export const THEME_INIT_SCRIPT_HASH = ', ''))) {
  console.log(`Hash already up to date: sha256-${hash}`)
} else {
  writeFileSync(FILE, source.replace(hashPattern, replacement))
  console.log(`Updated ${FILE} to sha256-${hash}`)
}
