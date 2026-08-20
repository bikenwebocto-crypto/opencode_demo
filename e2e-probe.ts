import { chromium } from '@playwright/test'

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  await page.goto('http://localhost:3000/login')
  await page.locator('input[name="email"]').first().fill('bikenwebocto@gmail.com')
  await page.locator('input[name="password"]').first().fill('biken@123')

  // Capture all navigations with final URLs
  const seen: string[] = []
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) seen.push('NAV:' + f.url()) })

  await page.locator('button[type="submit"]').first().click()

  // Mimic loginViaUi.waitForURL('**/admin/**')
  const t0 = Date.now()
  try {
    await page.waitForURL('**/admin/**', { timeout: 15000 })
    console.log('waitForURL(**/admin/**) RESOLVED ->', page.url())
  } catch {
    console.log('waitForURL(**/admin/**) TIMED OUT. current URL ->', page.url())
  }
  console.log('elapsed', (Date.now() - t0) / 1000, 's')
  console.log('NAVIGATIONS:', seen.join('\n  '))
  await browser.close()
}
main()