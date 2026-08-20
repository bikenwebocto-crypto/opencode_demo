// Test credential/configuration accessors.
// Never hard-code secrets: everything is read from process.env / e2e/.env.e2e.
// When a role's credentials are absent, auth-dependent specs SKIP instead of inventing values.

export const TEST_INDIVIDUAL: Record<string, string> = {
  SUPER_ADMIN_EMAIL: process.env.E2E_SUPER_ADMIN_EMAIL || '',
  SUPER_ADMIN_PASSWORD: process.env.E2E_SUPER_ADMIN_PASSWORD || '',
  MERCHANT_EMAIL: process.env.E2E_MERCHANT_EMAIL || '',
  MERCHANT_PASSWORD: process.env.E2E_MERCHANT_PASSWORD || '',
  COMPANY_ADMIN_EMAIL: process.env.E2E_COMPANY_ADMIN_EMAIL || '',
  COMPANY_ADMIN_PASSWORD: process.env.E2E_COMPANY_ADMIN_PASSWORD || '',
  EMPLOYEE_EMAIL: process.env.E2E_EMPLOYEE_EMAIL || '',
  EMPLOYEE_PASSWORD: process.env.E2E_EMPLOYEE_PASSWORD || '',
  UNMAPPED_EMAIL: process.env.E2E_UNMAPPED_EMAIL || '',
  UNMAPPED_PASSWORD: process.env.E2E_UNMAPPED_PASSWORD || '',
}

export interface TestUser {
  email: string
  password: string
  role: string
}

export type RoleKey = 'SUPER_ADMIN' | 'MERCHANT' | 'COMPANY_ADMIN' | 'EMPLOYEE'

const ROLE_PREFIX: Record<RoleKey, string> = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  MERCHANT: 'MERCHANT',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  EMPLOYEE: 'EMPLOYEE',
}

export function getUser(role: RoleKey): TestUser | null {
  const prefix = ROLE_PREFIX[role]
  const email = TEST_INDIVIDUAL[`${prefix}_EMAIL`]
  const password = TEST_INDIVIDUAL[`${prefix}_PASSWORD`]
  if (!email || !password) return null
  return { email, password, role: prefix }
}

export function roleConfigured(role: RoleKey): boolean {
  return getUser(role) !== null
}

export function anyRoleConfigured(): boolean {
  return (['SUPER_ADMIN', 'MERCHANT', 'COMPANY_ADMIN', 'EMPLOYEE'] as RoleKey[]).some(roleConfigured)
}

// Unique suffix for run-isolated entities (offers, businesses).
export function runId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000'