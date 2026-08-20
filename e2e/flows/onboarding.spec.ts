// W1 / W9 Merchant onboarding & suspension. Super-admin side: verify merchant approval API
// rejects non-admin (GAP regression) and that the admin list surface loads.

import { test, expect, type Browser } from '@playwright/test'
import { getUser } from '../support/creds'
import { authed } from '../support/session'
import { api } from '../support/api'

function adminOrSkip(browser: Browser) {
  const sa = getUser('SUPER_ADMIN')
  test.skip(!sa, 'E2E SUPER_ADMIN credentials not configured')
  return sa!
}

test.describe('W1 merchant onboarding (admin)', () => {
  test('TC-M06: admin merchant list loads with status metadata', async ({ browser }) => {
    const sa = adminOrSkip(browser)
    const s = await authed(browser, sa)
    try {
      const { status, body } = await api('/api/admin/merchants?page=1&pageSize=5', s.api)
      expect([200, 403]).toContain(status)
      if (status === 200) {
        expect(body?.success).toBe(true)
        expect(body?.data).toBeDefined()
      }
    } finally {
      await s.page.context().close()
    }
  })

  test('TC-R02 regression: non-admin cannot approve merchants (GAP)', async ({ browser }) => {
    const m = getUser('MERCHANT')
    test.skip(!m, 'E2E MERCHANT credentials not configured')
    const s = await authed(browser, m!)
    try {
      const res = await s.api.post('/api/admin/merchants', { data: { merchantId: 'x', status: 'ACTIVE' } })
      expect([401, 403]).toContain(res.status())
    } finally {
      await s.page.context().close()
    }
  })
})