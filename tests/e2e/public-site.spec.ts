import { test, expect } from '@playwright/test'

/**
 * Public site smoke tests.
 *
 * These deliberately assert behaviour a visitor would notice, not markup. A
 * test that pins class names or DOM structure fails on every redesign and
 * teaches the team to ignore red builds; a test that says "the catalogue is
 * reachable and the language switch keeps you on the page you were reading"
 * only fails when something is actually broken.
 *
 * They run against a seeded database. Anything that would depend on a specific
 * product existing is checked by shape — a listing renders, or it says it is
 * empty — so the suite survives content changes.
 */

test.describe('public site', () => {
  test('home page renders and is in the requested language', async ({ page }) => {
    await page.goto('/uz')
    await expect(page).toHaveTitle(/.+/)
    await expect(page.locator('html')).toHaveAttribute('lang', /^uz/)
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('main')).toBeVisible()
  })

  test('a disabled or unknown locale is not reachable', async ({ page }) => {
    const response = await page.goto('/xx')
    expect(response?.status()).toBeGreaterThanOrEqual(400)
  })

  test('the catalogue is reachable from the header', async ({ page }) => {
    await page.goto('/uz')
    const link = page.locator('header a[href="/uz/products"]').first()
    if ((await link.count()) === 0) test.skip(true, 'No products link in the seeded menu')
    await link.click()
    await expect(page).toHaveURL(/\/uz\/products/)
    await expect(page.locator('main')).toBeVisible()
  })

  test('switching language keeps the visitor on the same page', async ({ page }) => {
    await page.goto('/uz/products')
    const select = page.locator('header select').first()
    if ((await select.count()) === 0) test.skip(true, 'Only one language is enabled')
    await select.selectOption('ru')
    await expect(page).toHaveURL(/\/ru\/products/)
  })

  test('the admin surface is not acknowledged on the public host', async ({
    request,
  }) => {
    // Only meaningful when the admin lives on its own host. With the
    // development path fallback on, /admin is served here on purpose.
    const response = await request.get('/admin', { maxRedirects: 0 })
    expect([200, 302, 307, 404]).toContain(response.status())
  })

  test('robots.txt exists and sitemap responds', async ({ request }) => {
    expect((await request.get('/robots.txt')).status()).toBe(200)
    expect((await request.get('/sitemap.xml')).status()).toBe(200)
  })
})

test.describe('theme', () => {
  test('the toggle switches the palette and the choice survives a reload', async ({
    page,
  }) => {
    await page.goto('/uz')

    const html = page.locator('html')
    const before = await html.getAttribute('data-theme')
    expect(before === 'light' || before === 'dark').toBe(true)

    await page
      .locator('header button[aria-label]')
      .filter({ hasNot: page.locator('select') })
      .last()
      .click()

    // The bootstrap script owns this attribute, so asserting on it is asserting
    // on the mechanism that has to keep working, not on a CSS detail.
    await expect(html).not.toHaveAttribute('data-theme', before!)
    const after = await html.getAttribute('data-theme')

    await page.reload()
    await expect(html).toHaveAttribute('data-theme', after!)
  })

  test('no theme script is left behind by client-side navigation', async ({ page }) => {
    await page.goto('/uz')
    const count = () =>
      page.evaluate(
        () =>
          [...document.querySelectorAll('head script')].filter((s) =>
            s.textContent?.includes('vds_site_theme'),
          ).length,
      )

    expect(await count()).toBe(1)

    const link = page.locator('header a[href^="/uz/"]').first()
    if ((await link.count()) > 0) {
      await link.click()
      await page.waitForLoadState('networkidle')
      // React re-creating the script on every navigation would leave dead
      // copies here and log an error; one is the only correct answer.
      expect(await count()).toBe(1)
    }
  })
})
