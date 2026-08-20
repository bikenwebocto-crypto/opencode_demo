// Role-based dashboard navigation. TC-U03..U08. Needs role credentials.

import { test, expect, type Browser } from '@playwright/test'
import { getUser, type RoleKey } from '../support/creds'
import { authed } from '../support/session'

function userOrSkip(browser: Browser, role: RoleKey) {
  const user = getUser(role)
  test.skip(!user, `E2E ${role} credentials not configured`)
  return user!
}

test.describe('dashboard access by role', () => {
  test('TC-U03: EMPLOYEE is blocked from /admin and lands on /employee', async ({ browser }) => {
    const emp = userOrSkip(browser, 'EMPLOYEE')
    const s = await authed(browser, emp)
    try {
      await s.page.goto('/admin')
      await expect(s.page).toHaveURL(/.*\/employee/, { timeout: 20_000 })
    } finally {
      await s.page.context().close()
    }
  })

  test('TC-U04: MERCHANT is blocked from /company and lands on /merchant', async ({ browser }) => {
    const m = userOrSkip(browser, 'MERCHANT')
    const s = await authed(browser, m)
    try {
      await s.page.goto('/company')
      await expect(s.page).toHaveURL(/.*\/merchant/i, { timeout: 20_000 })
    } finally {
      await s.page.context().close()
    }
  })

  test('TC-U05: COMPANY_ADMIN is blocked from /admin and lands on /company', async ({ browser }) => {
    const ca = userOrSkip(browser, 'COMPANY_ADMIN')
    const s = await authed(browser, ca)
    try {
      await s.page.goto('/admin')
      await expect(s.page).toHaveURL(/.*\/company/i, { timeout: 20_000 })
    } finally {
      await s.page.context().close()
    }
  })

  test('TC-U08: SUPER_ADMIN can load /admin/overview', async ({ browser }) => {
    const sa = userOrSkip(browser, 'SUPER_ADMIN')
    const s = await authed(browser, sa)
    try {
      await s.page.goto('/admin/overview')
      await s.page.waitForURL('**/admin/overview', { timeout: 20_000 })
      await expect(s.page).toHaveURL(/.*\/admin\/overview/, { timeout: 20_000 })
    } finally {
      await s.page.context().close()
    }
  })

  test('TC-U08b: SUPER_ADMIN can load /admin/merchants list page', async ({ browser }) => {
    const sa = userOrSkip(browser, 'SUPER_ADMIN')
    const s = await authed(browser, sa)
    try {
      await s.page.goto('/admin/merchants')
      await s.page.waitForURL('**/admin/merchants', { timeout: 20_000 })
    } finally {
      await s.page.context().close()
    }
  })
})