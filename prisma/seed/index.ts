// Load .env before any module reads process.env (getEnv() validates on import).
import 'dotenv/config'
import { db } from '../../src/server/db/client'
import { seedLocales, seedSettings, seedSocialLinks } from './00-foundation'
import {
  seedProductCategories,
  seedPartnerCategories,
  seedArticleCategories,
  seedProductAttributes,
} from './10-taxonomy'
import { seedPartners, seedBrands } from './20-directory'
import { seedProducts } from './30-products'
import {
  seedServices,
  seedEvents,
  seedArticles,
  seedCertificates,
  seedFaqs,
  seedOffices,
} from './40-content'
import { seedPages, seedMenus, seedForms } from './50-structure'
import { seedMedia } from './60-media'
import { seedDemoDetails } from './65-demo-details'

/**
 * Development seed data.
 *
 * Two guarantees, both deliberate:
 *
 *  1. **It refuses to run in production** unless ALLOW_PRODUCTION_SEED is set.
 *     Fictional partners on a live supplier's site would be a serious
 *     misrepresentation, so the guard is in code rather than in a README.
 *
 *  2. **It is idempotent.** Every step checks for an existing record first, so
 *     re-running it after adding real content does not duplicate or overwrite
 *     anything.
 */

function guardEnvironment(): void {
  const isProduction = process.env.NODE_ENV === 'production'
  const allowed = ['1', 'true', 'yes'].includes(
    (process.env.ALLOW_PRODUCTION_SEED ?? '').toLowerCase(),
  )

  if (isProduction && !allowed) {
    console.error(
      '\nRefusing to seed a production database.\n' +
        'This data includes fictional partners, brands and products. Loading it\n' +
        'into a live site would misrepresent the business.\n\n' +
        'If you are certain, set ALLOW_PRODUCTION_SEED=true.\n',
    )
    process.exit(1)
  }
}

async function main(): Promise<void> {
  guardEnvironment()

  const started = Date.now()
  console.log('\nSeeding development data\n')

  const step = async (label: string, run: () => Promise<unknown>) => {
    process.stdout.write(`  ${label.padEnd(28, '.')} `)
    const result = await run()
    console.log('done')
    return result
  }

  await step('locales', seedLocales)
  await step('site settings', seedSettings)
  await step('social links', seedSocialLinks)

  await step('product categories', seedProductCategories)
  await step('partner categories', seedPartnerCategories)
  await step('article categories', seedArticleCategories)
  await step('product attributes', seedProductAttributes)

  const partnerIds = (await step('partners', seedPartners)) as Map<string, string>
  const brandIds = (await step('brands', () => seedBrands(partnerIds))) as Map<
    string,
    string
  >
  const productIds = (await step('products', () =>
    seedProducts(partnerIds, brandIds),
  )) as Map<string, string>

  const serviceIds = (await step('services', seedServices)) as Map<string, string>
  await step('events', () => seedEvents(partnerIds))
  await step('articles', () => seedArticles(productIds))
  await step('certificates', seedCertificates)
  await step('FAQs', () => seedFaqs(serviceIds))
  await step('offices', seedOffices)

  await step('pages and blocks', seedPages)
  await step('menus', seedMenus)
  await step('forms', seedForms)

  // Last, because they attach to everything above: generated artwork for every
  // listing, then the contact details and figures the other modules leave blank.
  await step('images', seedMedia)
  await step('demo details', seedDemoDetails)

  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`\nSeeded in ${seconds}s.\n`)

  console.log('IMPORTANT — this data is for development only:')
  console.log('  • Every partner, brand and product is fictional.')
  console.log('  • Contact details, addresses and figures are fictional too.')
  console.log(
    '    Phone numbers are from an unallocated range and email uses example.com,',
  )
  console.log('    so none of them reaches anyone. Replace them before launch.')
  console.log('  • Images are generated placeholder artwork, not photographs.')
  console.log(
    '  • A notice is shown on the site until site.general.demoContent is set to false.',
  )
  console.log('\nNext: npm run create-admin\n')
}

main()
  .catch((error: unknown) => {
    console.error('\nSeeding failed:', error instanceof Error ? error.message : error)
    console.error('\nIs the database running and migrated?  bash scripts/doctor.sh\n')
    process.exit(1)
  })
  .finally(() => {
    void db.$disconnect()
  })
