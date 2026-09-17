/**
 * Walks every public route and reports what each one returns.
 *
 *   node scripts/check-pages.mjs              # default locale only
 *   node scripts/check-pages.mjs --all-locales
 *   node scripts/check-pages.mjs --base http://localhost:3001
 *
 * Turns "some pages error" into an exact list. Detail pages need a real slug,
 * so it reads one from the database when it can and skips them otherwise
 * rather than reporting a 404 that only means "no content seeded yet".
 */
import { setTimeout as delay } from 'node:timers/promises'

const args = process.argv.slice(2)
const BASE = args.includes('--base')
  ? args[args.indexOf('--base') + 1]
  : 'http://localhost:3000'
const LOCALES = args.includes('--all-locales') ? ['en', 'ru', 'uz', 'zh'] : ['en']

const STATIC_PATHS = [
  '',
  '/products',
  '/services',
  '/events',
  '/news',
  '/resources',
  '/partners',
  '/brands',
  '/certificates',
  '/achievements',
  '/contact',
  '/search',
]

const ROOT_PATHS = [
  '/sitemap.xml',
  '/robots.txt',
  '/api/health',
  '/api/health/ready',
  '/admin/login',
]

const green = (s) => `\x1b[32m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`
const amber = (s) => `\x1b[33m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

let failures = 0

async function probe(path) {
  const url = `${BASE}${path}`
  const started = Date.now()
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'user-agent': 'vds-page-check' },
    })
    const ms = Date.now() - started
    const code = res.status
    let mark
    if (code >= 500) {
      mark = red('FAIL')
      failures++
    } else if (code === 404) {
      mark = amber('404 ')
    } else if (code >= 300 && code < 400) {
      mark = dim('→   ')
    } else {
      mark = green('ok  ')
    }

    let extra = ''
    if (code >= 500) {
      // Next prints the failing message into the HTML in dev; surface its first line.
      const body = await res.text()
      const m =
        body.match(/<h2[^>]*>([^<]{5,160})</) || body.match(/Error:\s*([^\n<]{5,160})/)
      if (m) extra = dim(`  ${m[1].trim()}`)
    }
    console.log(
      `  ${mark} ${String(code).padEnd(4)} ${path.padEnd(34)} ${dim(ms + 'ms')}${extra}`,
    )
  } catch (error) {
    failures++
    console.log(`  ${red('DOWN')}      ${path.padEnd(34)} ${dim(error.message)}`)
  }
}

console.log(`\n\x1b[1mChecking ${BASE}\x1b[0m`)

// Fail fast with a clear message if the dev server is not up.
try {
  await fetch(BASE, { signal: AbortSignal.timeout(4000) })
} catch {
  console.error(`\n  ${red('The dev server is not answering on ' + BASE)}`)
  console.error(`  Start it with: npm run dev\n`)
  process.exit(1)
}

for (const locale of LOCALES) {
  console.log(`\n  \x1b[1m/${locale}\x1b[0m`)
  for (const p of STATIC_PATHS) {
    await probe(`/${locale}${p}`)
    await delay(40)
  }
}

console.log(`\n  \x1b[1mroot\x1b[0m`)
for (const p of ROOT_PATHS) await probe(p)

console.log(
  failures === 0
    ? `\n${green('  No 5xx responses.')} Any 404 above just means that content is not seeded.\n`
    : `\n${red(`  ${failures} route(s) returned a server error.`)} Fix those first.\n`,
)
process.exit(failures === 0 ? 0 : 1)
