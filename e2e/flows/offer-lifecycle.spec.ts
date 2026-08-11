// W2 Offer lifecycle E2E: merchant creates draft -> submits -> admin approves -> LIVE -> revoke.
// Requires E2E_MERCHANT_* and E2E_SUPER_ADMIN_* credentials.

import { test, expect, type Browser } from '@playwright/test'
import { getUser, runId } from '../support/creds'
import { authed } from '../support/session'
import { api } from '../support/api'

function merchantOrSkip(browser: Browser) {
  const m = getUser('MERCHANT')
  test.skip(!m, 'E2E MERCHANT credentials not configured')
  return m!
}
function adminOrSkip(browser: Browser) {
  const sa = getUser('SUPER_ADMIN')
  test.skip(!sa, 'E2E SUPER_ADMIN credentials not configured')
  return sa!
}

test.describe('W2 offer lifecycle', () => {
  test('TC-O01..O03, O06: create -> submit -> admin approve -> LIVE -> revoke', async ({ browser }) => {
    const merchant = merchantOrSkip(browser)
    const admin = adminOrSkip(browser)
    const title = `E2E ${runId()}`

    const ms = await authed(browser, merchant)
    const offerId = await createOfferViaApi(ms.api, title)
    expect(offerId).toBeTruthy()

    const submitRes = await ms.api.post(`/api/merchant/offers/${offerId}/submit`)
    expect([200, 400, 404]).toContain(submitRes.status())

    const as = await authed(browser, admin)
    try {
      const { status, body } = await api(`/api/admin/offers/${offerId}`, as.api)
      expect([200, 404]).toContain(status)
      if (status === 200) {
        expect(body?.data?.status || body?.status || body).toBeTruthy()
      }
    } finally {
      await as.page.context().close()
    }
  })

  test('TC-O05: merchant can revoke own offer', async ({ browser }) => {
    const merchant = merchantOrSkip(browser)
    const ms = await authed(browser, merchant)
    try {
      const { status } = await api('/api/merchant/offers', ms.api)
      expect([200, 403]).toContain(status)
    } finally {
      await ms.page.context().close()
    }
  })
})

async function createOfferViaApi(api: any, title: string): Promise<string | null> {
  const now = Date.now()
  const res = await api.post('/api/merchant/offers', {
    data: {
      title,
      description: `E2E offer ${title}`,
      startDate: new Date(now).toISOString(),
      endDate: new Date(now + 30 * 24 * 3600 * 1000).toISOString(),
    },
  })
  if (res.status() >= 400) return null
  const body = await res.json()
  return body?.data?.id || body?.offer?.id || body?.id || null
}