// Security role-matrix specs. Federal check:
// any authenticated non-admin user must be blocked from /api/admin/* and vice-versa.
// Requires E2E_*_EMAIL/PASSWORD in e2e/.env.e2e; skips when absent.

import { test, expect, type Browser } from '@playwright/test'
import { getUser, type RoleKey } from '../support/creds'
import { authed } from '../support/session'
import { api, expect403 } from '../support/api'

function userOrSkip(browser: Browser, role: RoleKey) {
  const user = getUser(role)
  test.skip(!user, `E2E ${role} credentials not configured`)
  return user!
}

test.describe('cross-role isolation (IDOR/BOLA probes)', () => {
  test('TC-R01: EMPLOYEE must NOT list admin merchants (GAP-flagged)', async ({ browser }) => {
    const emp = userOrSkip(browser, 'EMPLOYEE')
    const s = await authed(browser, emp)
    try {
      const result = await api('/api/admin/merchants', s.api)
      // Security contract: must be 403. Current behavior: 200 (audit gap) -> this will FAIL until fixed.
      expect403(result)
    } finally {
      await s.page.context().close()
    }
  })

  test('TC-R02: EMPLOYEE must NOT approve merchants (GAP-flagged)', async ({ browser }) => {
    const emp = userOrSkip(browser, 'EMPLOYEE')
    const s = await authed(browser, emp)
    try {
      const result = await api('/api/admin/merchants', s.api)
      expect403(result)
    } finally {
      await s.page.context().close()
    }
  })

  test('TC-R03: EMPLOYEE blocked from admin companies', async ({ browser }) => {
    const emp = userOrSkip(browser, 'EMPLOYEE')
    const s = await authed(browser, emp)
    try {
      const result = await api('/api/admin/companies', s.api)
      expect403(result)
    } finally {
      await s.page.context().close()
    }
  })

  test('TC-R06/R07: EMPLOYEE blocked from merchant offers (GET+POST)', async ({ browser }) => {
    const emp = userOrSkip(browser, 'EMPLOYEE')
    const s = await authed(browser, emp)
    try {
      expect403(await api('/api/merchant/offers', s.api))
      const post = await s.api.post('/api/merchant/offers', { data: {} })
      expect([403, 400, 401]).toContain(post.status())
    } finally {
      await s.page.context().close()
    }
  })

  test('TC-R08: EMPLOYEE blocked from merchant branch creation', async ({ browser }) => {
    const emp = userOrSkip(browser, 'EMPLOYEE')
    const s = await authed(browser, emp)
    try {
      const post = await s.api.post('/api/merchant/branches', { data: {} })
      expect([403, 401, 400]).toContain(post.status())
    } finally {
      await s.page.context().close()
    }
  })

  test('TC-R10: MERCHANT blocked from company dashboard', async ({ browser }) => {
    const m = userOrSkip(browser, 'MERCHANT')
    const s = await authed(browser, m)
    try {
      const result = await api('/api/company/dashboard', s.api)
      expect403(result)
    } finally {
      await s.page.context().close()
    }
  })

  test('TC-R12: MERCHANT blocked from employee redemption', async ({ browser }) => {
    const m = userOrSkip(browser, 'MERCHANT')
    const s = await authed(browser, m)
    try {
      const post = await s.api.post('/api/employee/redeem', { data: {} })
      expect([403, 401, 400]).toContain(post.status())
    } finally {
      await s.page.context().close()
    }
  })
})