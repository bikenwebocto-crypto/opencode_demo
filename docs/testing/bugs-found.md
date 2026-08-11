# Bugs, Risks & Gaps — Audit Findings (2026-08-11)

Status legend: `AUDIT` = found by static inspection, not yet reproduced at runtime; `CONFIRMED` = reproduced by E2E run or direct probe.

---

## Bugs

### BUG-BKG-2026-001 — P0 · Admin merchant list/approve endpoints are role-open (AUDIT, encode-as-test)
- **Files:** `src/app/api/admin/merchants/route.ts`
- **Detail:** `GET /api/admin/merchants` (lines 36-38) has its admin check **commented out** (`// if (!user || user.userType !== 'admin') return unauthorized();`). `POST` (line 100-103) checks `if (!user) return unauthorized()` only — verifies *existence*, not admin role. So any authenticated user (e.g., EMPLOYEE) can list all merchants and execute admin review mutations.
- **Contrast:** `GET /api/admin/companies` (route.ts:52-57) correctly enforces `user.userType !== 'admin' → 403`. Pattern is inconsistent across the admin family.
- **Repro:** `e2e/api/security-matrix.spec.ts` TC-R01/TC-R02 (asserts 403; will fail until fixed).
- **Fix suggestion (app code, not applied here):** enforce `user.userType === 'admin'` in both GET and POST, mirroring `admin/companies`.

### BUG-BKG-2026-002 — P0/P2 · `GET /api/health` returns 404 (CONFIRMED)
- **Files:** `src/middleware.ts:29` lists `"/api/health"` as public; **no `src/app/api/health/route.ts` exists**.
- **Detail:** E2E TC-A13 call to `/api/health` returned **404**. Liveness/health monitoring hooks are broken.
- **Repro:** `npx playwright test e2e/api/auth-contracts.spec.ts` (TC-A13 `fixme`).

---

## Risks

### R-01 — Middleware does not role-gate API routes (P0)
`src/middleware.ts:129-134` passes all authenticated `/api/*` through with only `x-auth-email` set, **no role enforcement**. Every one of 143 route files must independently enforce authorization; rarely does the codebase share that helper consistently (see BUG-001). High BOLA/IDOR exposure surface → security-matrix specs (`e2e/api/security-matrix.spec.ts`).

### R-02 — Middleware role cache allows stale gating (P1)
`roleCache` TTL 5 min (`src/middleware.ts:18-20,54`). After an admin approves a merchant / role change, dashboard gating can lag ~5 min. E2E must log out/in or accept the lag.

### R-03 — Auth identity lives only in Supabase Auth (P1)
Passwords are unknowable at the app/DB layer; login is only real via Supabase Auth UI. This is why `e2e/.env.e2e` credentials are required and authed specs skip without them. No programmatic user-provisioning exists in the repo.

### R-04 — Admin auth inconsistency (P1)
Auth checks differ per admin route: some use `getCurrentUser()`, some `resolveAuthenticatedUser()`, some `requireAdmin()`, some none. Centralize to a single guard.

### R-05 — Seed drift (P1)
`prisma/seed.ts` references `admin@perks.com` etc., but live DB no longer contains the seed admin (`e2e-pack-probe` showed actual emails like `bikenwebocto@gmail.com`). Tests must resolve accounts at runtime, not hard-code seeds.

---

## Environment / Tooling Gaps

- `test:integration` script broken — `vitest.integration.config.ts` absent.
- `analytics:aggregate` script broken — script file missing.
- Dev server can be started by the Playwright `webServer` block (`npm run dev`); verified reachable at `localhost:3000`.
- MSW + supertest installed but no suites found; Playwright chosen as the E2E runner (`testDir: ./e2e`).

---

## Verify-once-creds-are-present
Authenticated specs to confirm with real users (`e2e/.env.e2e`):
- Role isolation matrix (TC-R01..R14) — will flag BUG-001 as red.
- Offer lifecycle recreate→submit→approve→revoke (TC-O01..O05).
- Redemption web + mobile (TC-D01..D05), onboarding/suspension (TC-M06/M07).
- Company-admin isolation (TC-C01..C04), banner booking (TC-B01/B02).