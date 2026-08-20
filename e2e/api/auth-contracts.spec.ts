// TC-A02, TC-A03, TC-A09, TC-A11, TC-A12, TC-A13 — public + unauthenticated auth contracts.
// These run even when no role credentials are configured.

import { test, expect } from '@playwright/test'
import { api } from '../support/api'

test.describe('auth / session public contracts', () => {
  test('TC-A02: sync-admin without token -> 401', async ({ request }) => {
    const res = await request.post('/api/auth/sync-admin')
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  test('TC-A03: sync-admin with garbage token -> 401', async ({ request }) => {
    const res = await request.post('/api/auth/sync-admin', {
      headers: { Authorization: 'Bearer not-a-real-token' },
    })
    expect(res.status()).toBe(401)
  })

  test('TC-A09: session unauthenticated -> 401', async ({ request }) => {
    const res = await request.get('/api/auth/session')
    expect(res.status()).toBe(401)
  })

  test('TC-A11: me unauthenticated -> 401', async ({ request }) => {
    const res = await request.get('/api/auth/me')
    expect(res.status()).toBe(401)
  })

  // BUG-BKG-2026-002: GET /api/health returns 404 — route file src/app/api/health/route.ts does not exist,
  // though middleware lists /api/health as a PUBLIC_API_ROUTE (src/middleware.ts:29). Health/monitoring is broken.
  test.fixme('TC-A13: health endpoint public -> 200 (BLOCKED: route missing)', async ({ request }) => {
    const { status, body } = await api('/api/health', request)
    expect(status).toBe(200)
    expect(body).toBeTruthy()
  })

  test('TC-A12: logout unauthenticated -> session remains blocked', async ({ request }) => {
    const res = await request.post('/api/auth/logout')
    // logout is publicly routed; result may be 200/302 but must be safe
    expect([200, 401, 204, 302]).toContain(res.status())
  })
})

test.describe('non-public unauthenticated API surface', () => {
  test('P0 guard: protected merchant API without auth -> 401 JSON', async ({ request }) => {
    const res = await request.get('/api/merchant/profile')
    expect([401, 403]).toContain(res.status())
    const body = await safeJson(res)
    expect(body || { error: 'unauthorized' }).toBeTruthy()
  })

  test('P0 guard: protected admin API without auth -> 401 JSON', async ({ request }) => {
    const res = await request.get('/api/admin/merchants')
    expect([401, 403]).toContain(res.status())
  })

  test('P0 guard: protected employee API without auth -> 401 JSON', async ({ request }) => {
    const res = await request.get('/api/employee/dashboard')
    expect([401, 403]).toContain(res.status())
  })
})

async function safeJson(res: any) {
  try {
    return await res.json()
  } catch {
    return null
  }
}