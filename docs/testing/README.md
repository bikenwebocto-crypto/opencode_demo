# E2E Testing — README

Playwright-based test suite for PerkSystem. Root config: `playwright.config.ts`, specs under `e2e/`.

## Prerequisites
- Dev server running at `http://localhost:3000` (config will auto-start `npm run dev` if not running; set `E2E_BASE_URL` to point elsewhere, e.g. a deployed env).
- Playwright browsers: `npx playwright install chromium` (first run).

## Test credentials
Authenticated specs require real Supabase Auth users **mapped to app Accounts by role**.
Passwords live only in Supabase Auth — they must be provisioned by whoever manages that project.
Configure them for your environment:

1. `copy e2e/.env.e2e.example e2e/.env.e2e`
2. Fill `E2E_*_EMAIL` / `E2E_*_PASSWORD` for: SUPER_ADMIN, MERCHANT, COMPANY_ADMIN, EMPLOYEE, plus an UNMAPPED pair for negative-login tests.
3. Add any extra env to `e2e/.env.e2e` (root `.env` is also loaded).

> `.env.e2e` is git-ignored. When a role's credentials are missing, that role's specs **skip** with a message — the suite never invents credentials.

## Commands
```
npx playwright test                 # full suite
npx playwright test e2e/api         # api layer only
npx playwright test --project=firefox
npx playwright show-report          # HTML report
```

Env knobs: `E2E_BASE_URL`, `E2E_BROWSER=chromium|firefox|webkit`, `E2E_WEB_SERVER_COMMAND`.

## Spec → Test-Case mapping
`docs/testing/test-cases.md` lists TC ids (e.g., TC-R01). The first comment in each `test()` block carries its TC id and the audited gap/risk it encodes (see `docs/testing/bugs-found.md`).

## Suite layout
- `e2e/api/` — contract + security matrix (unauth 401s run without creds)
- `e2e/ui/` — login/navigation/role gating
- `e2e/flows/` — orchestrated business workflows
- `e2e/support/` — creds, session, login, api helpers
- `e2e/global-setup.ts` — prereq probe + run anchor