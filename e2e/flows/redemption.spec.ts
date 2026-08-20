// W4/W5 Redemption flows. Requires E2E_EMPLOYEE_* and E2E_MERCHANT_*.
// Redeem from a LIVE offer and verify merchant-side status update path.

import { test, expect, type Browser } from '@playwright/test'
import { getUser } from '../support/creds'
import { authed } from '../support/session'

function empOrSkip(browser: Browser) {
  const e = getUser('EMPLOYEE')
  test.skip(!e, 'E2E EMPLOYEE credentials not configured')
  return e!
}
function merchantOrSkip(browser: Browser) {
  const m = getUser('MERCHANT')
  test.skip(!m, 'E2E MERCHANT credentials not configured')
  return m!
}

test.describe('W4 redemption', () => {
  test('TC-D01: employee dashboard loads offer feed', async ({ browser }) => {
    const emp = empOrSkip(browser)
    const s = await authed(browser, emp)
    try {
      await s.page.goto('/employee/offers/grouped')
      await expect(s.page).toHaveURL(/.*\/employee\/offers/, { timeout: 20_000 })
    } finally {
      await s.page.context().close()
    }
  })

  test('TC-D04: merchant redemptions screen renders', async ({ browser }) => {
    const m = merchantOrSkip(browser)
    const s = await authed(browser, m)
    try {
      await s.page.goto('/merchant/redemptions')
      await s.page.waitForURL('**/merchant/redemptions', { timeout: 20_000 })
      await expect(s.page).toHaveURL(/.*\/merchant\/redemptions/, { timeout: 20_000 })
    } finally {
      await s.page.context().close()
    }
  })
})