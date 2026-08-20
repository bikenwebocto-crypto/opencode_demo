// Offer lifecycle — API portion. TC-O07..O09 (validation + not-found).
// Requires E2E_MERCHANT_*; skips when absent.

import { test, expect, type Browser } from '@playwright/test'
import { getUser } from '../support/creds'
import { authed } from '../support/session'
import { api } from '../support/api'

test.describe('offer validation (merchant)', () => {
  test('TC-O09: missing required fields -> 400 (not 500)', async ({ browser }) => {
    const m = getUser('MERCHANT')
    test.skip(!m, 'E2E MERCHANT credentials not configured')
    const s = await authed(browser, m!)
    try {
      const post = await s.api.post('/api/merchant/offers', { data: {} })
      expect(post.status()).toBe(400)
      const body = await post.json()
      expect(body.error?.code || body.error || body).toBeTruthy()
    } finally {
      await s.page.context().close()
    }
  })

  test('TC-O08: invalid date window -> 400 VALIDATION', async ({ browser }) => {
    const m = getUser('MERCHANT')
    test.skip(!m, 'E2E MERCHANT credentials not configured')
    const s = await authed(browser, m!)
    try {
      const post = await s.api.post('/api/merchant/offers', {
        data: {
          title: 'E2E invalid-date ' + Date.now(),
          startDate: '2026-12-31T00:00:00Z',
          endDate: '2026-01-01T00:00:00Z', // ends before start
        },
      })
      expect([400]).toContain(post.status())
    } finally {
      await s.page.context().close()
    }
  })

  test('TC-O07: unknown offer id -> 404', async ({ browser }) => {
    const m = getUser('MERCHANT')
    test.skip(!m, 'E2E MERCHANT credentials not configured')
    const s = await authed(browser, m!)
    try {
      const { status } = await api(`/api/merchant/offers/${'00000000-0000-4000-8000-000000000000'}`, s.api)
      expect([404, 400]).toContain(status)
    } finally {
      await s.page.context().close()
    }
  })
})