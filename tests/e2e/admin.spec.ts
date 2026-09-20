import { test, expect } from '@playwright/test'

/**
 * Administration smoke tests.
 *
 * Credentials come from the environment rather than the file. A default
 * password committed to a repository is how a staging box ends up with a known
 * login, so the authenticated tests skip themselves when E2E_ADMIN_EMAIL and
 * E2E_ADMIN_PASSWORD are not set instead of falling back to something guessable.
 */

const email = process.env.E2E_ADMIN_EMAIL
const password = process.env.E2E_ADMIN_PASSWORD
const authenticated = Boolean(email && password)

test.describe('admin sign-in', () => {
  test('the panel is closed to anonymous visitors', async ({ page }) => {
    await page.goto('/admin/pages')
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('the sign-in screen is in the panel language', async ({ page }) => {
    await page.goto('/admin/login')
    // Uzbek is the panel default; the point of the assertion is that the screen
    // is translated at all, so it checks the language attribute rather than a
    // particular word.
    await expect(page.locator('html')).toHaveAttribute('lang', 'uz')
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
  })

  test('a wrong password is rejected without saying which field was wrong', async ({
    page,
  }) => {
    await page.goto('/admin/login')
    await page.fill('input[name="email"]', 'nobody@example.invalid')
    await page.fill('input[name="password"]', 'definitely-not-the-password')
    await page.click('button[type="submit"]')

    const alert = page.locator('[role="alert"]')
    await expect(alert).toBeVisible()
    // An error naming the field tells an attacker which addresses exist.
    await expect(alert).not.toContainText(/no such user|unknown email/i)
  })
})

test.describe('admin panel', () => {
  test.skip(!authenticated, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run these')

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/login')
    await page.fill('input[name="email"]', email!)
    await page.fill('input[name="password"]', password!)
    await page.click('button[type="submit"]')
    await expect(page).not.toHaveURL(/\/admin\/login/)
  })

  test('the dashboard loads', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.locator('main')).toBeVisible()
  })

  test('the theme toggle repaints the panel', async ({ page }) => {
    await page.goto('/admin')
    const html = page.locator('html')
    const before = await html.getAttribute('data-theme')
    await page.locator('header button[aria-label]').last().click()
    await expect(html).not.toHaveAttribute('data-theme', before ?? 'light')
  })

  test('a page opens its section editor', async ({ page }) => {
    await page.goto('/admin/pages')
    const row = page.locator('main a[href^="/admin/pages/"]').first()
    if ((await row.count()) === 0) test.skip(true, 'No pages in this database')
    await row.click()

    // The section list is loaded by the client after the form renders, so the
    // assertion waits for it rather than for the page itself.
    await expect(
      page.getByRole('button', { name: /move up|yuqoriga|выше|上移/i }).first(),
    ).toBeVisible({
      timeout: 15_000,
    })
  })

  test('settings save as one group', async ({ page }) => {
    await page.goto('/admin/settings')
    await expect(page.locator('main')).toBeVisible()
    // One save control for the whole group, not one per field.
    const saves = page.getByRole('button', { name: /^(save|saqlash|сохранить|保存)/i })
    expect(await saves.count()).toBeLessThanOrEqual(2)
  })
})

test.describe('import and export', () => {
  test('the screen is closed to anonymous visitors', async ({ page }) => {
    await page.goto('/admin/transfer')
    await expect(page).toHaveURL(/\/admin\/login/)
  })
})

test.describe('import and export, signed in', () => {
  test.skip(!authenticated, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run these')

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/login')
    await page.fill('input[name="email"]', email!)
    await page.fill('input[name="password"]', password!)
    await page.click('button[type="submit"]')
    await expect(page).not.toHaveURL(/\/admin\/login/)
  })

  test('an export downloads a file named after the content type', async ({ page }) => {
    await page.goto('/admin/transfer')
    await expect(page.locator('main')).toBeVisible()

    const download = page.waitForEvent('download')
    await page
      .getByRole('button', {
        name: /download export|eksportni|скачать экспорт|下载导出/i,
      })
      .click()

    const file = await download
    expect(file.suggestedFilename()).toMatch(/\.(csv|json)$/)
  })

  test('importing asks for a preview before it will apply anything', async ({ page }) => {
    await page.goto('/admin/transfer')

    // Apply is inert until a preview has run: a bulk write must never be one
    // stray click away.
    const apply = page.getByRole('button', {
      name: /apply import|importni|применить импорт|执行导入/i,
    })
    if ((await apply.count()) === 0) test.skip(true, 'This account cannot import')
    await expect(apply).toBeDisabled()
  })
})
