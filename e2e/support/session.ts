// Auth-aware fixtures. Each spec that needs a role does: const { page, api } = await authed(browser, users.MERCHANT)
// Returns a page that performed a real Supabase Auth UI login and an API context seeded with its cookies.

import { expect, type Browser, type Page, type APIRequestContext } from '@playwright/test'
import type { TestUser } from '../support/creds'
import { loginViaUi } from '../support/login'
import { createAuthedApiContext } from '../support/api'

export interface AuthedSession {
  page: Page
  api: APIRequestContext
  url: string
}

export async function authed(browser: Browser, user: TestUser): Promise<AuthedSession> {
  const context = await browser.newContext()
  const page = await context.newPage()
  const url = await loginViaUi(page, user)
  const api = await createAuthedApiContext(context, context.request)
  return { page, api, url }
}

export async function openAndExpectDashboard(page: Page, expectedPrefix: string, userEmail: string): Promise<void> {
  await page.goto(expectedPrefix)
  await expect
    .poll(() => page.url(), { timeout: 20_000 })
    .toMatch(new RegExp(`^.*${expectedPrefix.replace('/', '\\/')}(/|$)`))
  await page.getByText(userEmail).first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
}