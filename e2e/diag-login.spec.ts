import { test } from '@playwright/test'

test('diagnose super admin login under playwright runner', async ({ page }) => {
  const logs: string[] = []
  page.on('console', (m) => logs.push(`[console:${m.type()}] ${m.text().slice(0, 180)}`))
  page.on('requestfailed', (r) => logs.push(`[reqfail] ${r.url().slice(0, 120)} ${r.failure()?.errorText}`))
  page.on('response', async (r) => {
    if (r.url().includes('sync-admin')) {
      let b = ''
      try { b = (await r.body()).toString().slice(0, 200) } catch {}
      logs.push(`[sync-admin ${r.status()}] ${b}`)
    }
  })

  await page.goto('http://localhost:3000/login')
  await page.locator('input[name="email"]').first().waitFor({ state: 'attached', timeout: 15000 })
  await page.locator('input[name="email"]').first().fill('bikenwebocto@gmail.com')
  await page.locator('input[name="password"]').first().fill('biken@123')
  await page.locator('button[type="submit"]').first().click()

  const urlHistory: string[] = [page.url()]
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500)
    if (!urlHistory.includes(page.url())) urlHistory.push(page.url())
  }

  console.log('URL HISTORY:', urlHistory.join(' -> '))
  console.log(logs.join('\n'))
  console.log('FINAL URL:', page.url())
})