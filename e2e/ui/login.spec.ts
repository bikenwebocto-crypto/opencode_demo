// UI login & redirection specs. TC-U01, TC-U02 run without creds; TC-U06 needs a known unmapped account.

import { test, expect } from '@playwright/test'
import { BASE_URL } from '../support/creds'

test.describe('login page (public)', () => {
  test('TC-U01: / redirects to /login when unauthenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(new RegExp(`${BASE_URL}/login`), { timeout: 15_000 })
  })

  test('TC-U02: login page renders email+password form', async ({ page }) => {
    await page.goto('/login')
    const email = page.locator('input[name="email"]').first()
    const password = page.locator('input[name="password"]').first()
    await expect(email).toBeAttached({ timeout: 15_000 })
    await expect(password).toBeAttached()
    await expect(page.locator('button[type="submit"]').first()).toBeAttached()
  })

  test('TC-U02b: protected employee route redirects to /login when unauthenticated', async ({ page }) => {
    await page.goto('/employee/offers/grouped')
    await expect(page).toHaveURL(new RegExp(`${BASE_URL}/login`), { timeout: 15_000 })
  })
})

test.describe('login with unmapped account (needs E2E_UNMAPPED_*)', () => {
  test('TC-U06 / TC-A04: unmapped/disabled email shows mapped error and stays on /login', async ({ page }) => {
    const email = process.env.E2E_UNMAPPED_EMAIL
    const password = process.env.E2E_UNMAPPED_PASSWORD
    test.skip(!email || !password, 'E2E_UNMAPPED_* credentials not configured')

    await page.goto('/login')
    await page.locator('input[name="email"]').first().waitFor({ state: 'attached', timeout: 15_000 })
    await page.locator('input[name="email"]').first().fill(email!)
    await page.locator('input[name="password"]').first().fill(password!)
    await page.locator('button[type="submit"]').first().click()
    await expect(page).toHaveURL(new RegExp(`${BASE_URL}/login`), { timeout: 30_000 })
    await expect(page.getByText(/not mapped|contact your administrator/i).first()).toBeVisible({ timeout: 20_000 })
  })
})