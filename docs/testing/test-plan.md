# Master E2E Test Plan — PerkSystem (Rewards & Loyalty Platform)

Status: Draft v1
Tooling: Playwright ^1.62, TypeScript, app under Next.js (App Router). Test root: `e2e/`.

---

## 1. Application Overview

PerkSystem is a multi-tenant rewards platform connecting **companies → employees → merchants → offers → redemptions**, managed by a **platform admin** layer.

Core entities (Prisma): `Account`, `AdminUser`, `Company`, `CompanyAdmin`, `Employee`, `Merchant`, `Branch`, `Offer`, `Redemption`, `Category`, `ActionQueue`, `AuditLog`, `Notification`, `Banner`, `BannerBooking`, `Issue`, `Instrument`, `DeviceToken`.

Four dashboards exist, one per role: `/admin`, `/company`, `/merchant`, `/employee`. Mobile experience for employees is served via `/api/mobile/*`.

## 2. Roles & Authorization Model

| Role | ProfileType | Dashboard | Allowed path prefixes | Notes |
|---|---|---|---|---|
| SUPER_ADMIN | ADMIN | `/admin` | `/admin` | `AdminUser` with `userType='admin'`; admins also carry sparse `role` ACL |
| COMPANY_ADMIN | COMPANY | `/company` | `/company` | One or more per Company; `isActive` flag |
| MERCHANT | MERCHANT | `/merchant` | `/merchant` | Owns offers, branches, redemptions |
| EMPLOYEE | EMPLOYEE | `/employee` | `/employee` | Belongs to a Company |

Admin ACL (from `prisma.schema`): `ADMIN`, `SUPPORT_ADMIN`, `FINANCE_ADMIN`, `CONTENT_ADMIN`, plus a boolean/`role` system on `AdminUser`.

### Auth flow (browser)
1. **Supabase email+password** sign-in via `@supabase/auth-ui-react` on `/login` (`login-client.tsx`).
2. On `SIGNED_IN`, client POSTs `Bearer <access_token>` to **`POST /api/auth/sync-admin`**.
3. `sync-admin` resolves an `Account` (by `authUserId` first, then by email), enforces `status=ACTIVE`, updates `lastLoginAt`, returns `{ role, redirectTo }`.
4. Client pushes to `redirectTo`.
5. **Middleware** (`src/middleware.ts`) enforces page access: role → dashboard map, `ROLE_ACCESS_MAP` gating `/admin`,`/company`,`/merchant`,`/employee`; role fetched via `/api/auth/session` with a 5-minute in-memory cache.

### Auth flow (mobile / API)
- Bearer-token flow: `Authorization: Bearer <supabase access_token>` decoded by `authenticateFromBearer` in `src/lib/auth` (mobile), and in middleware for `/api/*` (no role check — **API routes are role-free at the middleware level**; enforcement must be in-route).

### Key auth decisions that shape tests
- Middleware does **not** role-check API routes. **Authorization for `/api/*` happens inside each route** via `getCurrentUser()` / `requireAdmin()` / `getAuthenticatedMobileEmployee()`.
- `getCurrentUser()` (in `src/lib/supabase/server.ts`) returns user + role info but **several routes never enforce the result** — see risk table §8.
- Role changes (e.g., merchant approval) are subject to the **5-minute middleware role cache**.

## 3. Authentication & Session Spec (testable contracts)

| # | Contract | Expected |
|---|---|---|
| A1 | `POST /api/auth/sync-admin` with valid token | `200 {success, role, redirectTo}` |
| A2 | `POST /api/auth/sync-admin` with no/invalid token | `401 {error:'Unauthorized'}` |
| A3 | `POST /api/auth/sync-admin` for PENDING/SUSPENDED account | `403 code=ACCOUNT_DISABLED` |
| A4 | `POST /api/auth/sync-admin` with email not mapped to Account | `403 code=ACCOUNT_NOT_MAPPED` |
| A5 | `GET /api/auth/session` with cookies / `x-middleware-email` | `200 {authenticated, user:{id,email,role}}` |
| A6 | `GET /api/auth/session` unauthenticated | `401` |
| A7 | `GET /api/auth/me` with valid session | `200` with user profile |
| A8 | `GET /api/health` | `200` (public) |
| A9 | Middleware `/` → redirect `/login` | unauthenticated |
| A10 | EMPLOYEE visiting `/admin` | redirected to `/employee` |
| A11 | Unauthenticated API (non-public) | `401` JSON |
| A12 | Login error for account with no role mapping | UI shows mapped error, stays on `/login` |
| A13 | Logout via `POST /api/auth/logout` | session cleared; protected routes blocked |

## 4. API Inventory (audited 2026-08-11)

Route families (all under `/api`):

- **auth/** (4): `sync-admin`, `session`, `me`, `logout`
- **admin/** (54): analytics(+sub), action-queue(+actions), banners(+bookings), billing(summary/audit/companies/[id]/status/review/mark-paid), companies(+launch-pack, csv-preview, csv-confirm, city-readiness, billing-reminder, admins, employees), employees(+status, admin set), merchants(+create, import, export, dashboard/[id], manage, offers, store-map, quota), notifications(+announce), offers(deleted/restore/permanent-delete/generate-qr), settings/login-branding, stores, themes
- **merchant/** (21): analytics(summary/trends), banners/book, branches(CRUD+[id]), issues, notifications, offers(create/submit/revoke), profile, redemptions(redeem/[id]/status), settings(notifications/change-password/change-email), store-map
- **employee/** (14): dashboard/stats, near-stores, notifications, offers(grouped/view/[id]), profile, redeem, reviews, saved
- **company/** (15): analytics, billing(+invoice download), dashboard, employees(+import), merchants, offers, profile, settings
- **mobile/** (19): auth, instruments, home/(:id), offers(+redeem/scan), profile, etc.
- **public/misc**: banners, categories, complaints (6), vouchers, analytics, device-tokens, firebase-config, notifications, instruments, public, webhooks, health

## 5. UI Route Inventory (key pages)

- Public: `/login`, `/auth/callback`
- `/admin/*`: overview, merchants(+new/import/[id]), companies(+[id]), offers(+moderation/[id]), employees, banners, action-queue, billing, settings(+login-branding, themes, admins, stores, notification-templates)
- `/company/*`: overview, dashboard, employees(+import/invite/[id]), merchants, offers, billing, settings(+profile, subscriptions)
- `/merchant/*`: overview, dashboard, offers(+new/[id]/history), branches, redemptions, banners, profile, settings
- `/employee/*`: home, offers(+grouped/category/offer/[id]), saved, redeemed history, profile, settings, help

## 6. Business Workflows (orchestrated E2E)

### W1 — Merchant onboarding → approval
MERCHANT registers (or is seeded) → PENDING → admin reviews in `/admin/merchants` → approves (raises ActionQueue + audit + notification) → merchant sees ACTIVE dashboard (allow middleware cache refresh).

### W2 — Offer lifecycle: create → submit → admin approve → LIVE → revoke
MERCHANT creates offer (DRAFT) → submits (PENDING, raises FIRST_OFFER_APPROVAL ActionQueue if first) → ADMIN approves/activates → offer becomes LIVE → appears in EMPLOYEE feed → merchant can revoke → status REVOKED/INACTIVE, removed from employee feed.

### W3 — Branch management
MERCHANT adds branch (validation: city/state/coordinates) → branch visible on store-map (public) → edit → status reflects and merchant dashboard counts update.

### W4 — Redemption flow (web)
EMPLOYEE views LIVE offer → claims/redeems → merchant or system validates → `Redemption` created (status per merchant: PENDING/COMPLETED/REJECTED) → employee history + merchant redemptions + admin analytics update.

### W5 — Redemption flow (mobile scan)
EMPLOYEE logs in on mobile (`/api/mobile`) → scans merchant QR / redeems code → `POST /api/mobile/offers/redeem` validates token off batch → redemption recorded.

### W6 — Banner booking
MERCHANT books a banner (banner + date range) → ADMIN approves → banner becomes public/live in employee feed.

### W7 — Employee saved offers / notifications
EMPLOYEE saves offer → saved list persists → issue/notification created across roles.

### W8 — Company admin employee management
COMPANY_ADMIN imports/invites employees (CSV preview → confirm) → employees appear; invited employee created as PENDING account; can be deactivated.

### W9 — Account disabled path
ADMIN suspends a merchant/employee (status SUSPENDED/INACTIVE) → subsequent `sync-admin` returns ACCOUNT_DISABLED → UI blocks login with clear message.

## 7. Test Strategy & Global Structure

Three layers (per task spec):

1. **API contract + security layer** (`e2e/api/*`): role matrix, IDOR/BOLA attempts, validation, status codes, unauth 401s. Fast, no UI dependency.
2. **UI layer** (`e2e/ui/*`): login flows, role navigation, page loading with hard-to-signal stable selectors.
3. **Cross-layer E2E** (`e2e/flows/*`): full W1–W9 orchestration using API helpers to arrange state + UI to verify.

### Fixture/auth strategy
- **Credentials are environment-driven** via `e2e/.env.e2e` (git-ignored) or env vars: `E2E_SUPER_ADMIN_EMAIL/PASSWORD`, `E2E_MERCHANT_EMAIL/PASSWORD`, `E2E_COMPANY_ADMIN_EMAIL/PASSWORD`, `E2E_EMPLOYEE_EMAIL/PASSWORD`, plus a non-mapped account.
- **Supabase Auth is the identity source**; passwords are only discoverable at runtime by whoever provisions the users. Test runner will **skip** auth-dependent suites with an explicit "credentials not configured" message when env vars are absent (never invent values).
- Storage state snapshot per role is created once per run in `global-setup` (fast reuse), refreshed if a login fails.

### Seeded / DB data
- Do **not** rely on seed identity for assertions where data is nondeterministic (ratings, random redemptions). Use relational breadth assertions (`>= 1`) and create isolated data per test run with cleanup where safe.
- Unique-generation helper for offer titles / businesses: timestamp/UUID suffix → enables repeat runs.

### Execution levels
| Level | Scope | When |
|---|---|---|
| P0 | Auth correctness, role boundaries, offer lifecycle, redemption | every CI/commit gate |
| P1 | Merchant onboarding, banner booking, branch CRUD, company employees | nightly |
| P2 | Mobile endpoints, notifications, billing, analytics rendering | nightly/longer |
| P3 | Content (branding/themes), store-map geo, CSV imports | on-demand |

## 8. Known Risks, Bugs & Gaps (audit findings)

> Full traceability lives in `docs/testing/test-cases.md` and `docs/testing/bugs-found.md`.

1. **P0 — Missing admin role checks.** `GET /api/admin/merchants` (route.ts:38) has its admin check commented out; `POST` only verifies a user exists, not `userType==='admin'`. Any authenticated user can list merchants / execute merchant approval mutations. Confirmed pattern to test: employee calling `/api/admin/merchants` must be blocked by design; today it is a live gap.
2. **P0 — Middleware authorizes API by auth only, not role.** Every `/api/*` route must self-enforce. Wide surface (143+ route files) → BOLA/IDOR risk; tests must assert cross-role denial per family.
3. **P1 — `test:integration` script is broken** (`vitest.integration.config.ts` absent), **`analytics:aggregate` script missing** — blocked local validated integration of analytics services.
4. **P1 — Seed drift.** `admin@perks.com` no longer present; live DB has real user emails. E2E must not hard-code seed identities.
5. **P1 — Middleware role cache (5 min).** After admin approves a merchant/role change, dashboard gating may lag; tests must accommodate or force cache bypass (log out/in).
6. **P1 — Login UI selectors** are Supabase Auth UI hashed classes (`c-bOcPnF`); use attribute/text selectors (`input[name=email]`, `input[name=password]`, role/text).
7. **P2 — Mobile auth** requires real Supabase users and device-token flows; only contract-level tests possible without a provisioning capability.
8. **P2 — External services** (SMTP invitation emails, Firebase push) have no sandbox → assert API acceptance, not delivery.

## 9. Test Data & Cleanup Strategy

- **Isolated-by-run identities**: `e2e.<runId>@localhost.test` — created through the app where possible; otherwise via direct Prisma (dev DB only, guarded by `NODE_ENV !== 'production'`).
- **Cleanup**: unique-created offers/merchants/branches removed at teardown (best-effort); suite is designed to be re-runnable.
- **Never** write secrets to files; `.env.e2e` is git-ignored.
- DB access for arrangement: allowed in tests? **A hosted Supabase Postgres is the only DB** — arrangement via app APIs preferred; direct Prisma used only for seeding needed entities and is documented per test.

## 10. Environment Matrix

| Need | Status @ audit | Test handling |
|---|---|---|
| Dev server `localhost:3000` | DOWN | `playwright.config` `webServer` starts `npm run dev` on demand |
| Supabase (hosted) | URL configured, reachable DB | used as-is |
| Supabase Auth test users | missing (passwords unknown) | `E2E_*` env; tests skip if absent |
| Test DB | none dedicated | hosted remote DB w/ unique-per-run data |
| SMTP/Firebase/Stripe | configured but sandbox-only | assert API surfaces only |

## 11. Deliverables / Roadmap

1. ✅ `docs/testing/test-plan.md` (this)
2. ✅ `docs/testing/test-cases.md` — TC catalog
3. `e2e/` — Playwright suite (Playwright config, fixtures, api/ui/flows specs)
4. `docs/testing/bugs-found.md` — findings fed from runs
5. `docs/testing/README.md` — how to provision creds + run