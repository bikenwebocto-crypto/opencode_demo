// Mobile authentication helper.
//
// Single source of truth for mobile-endpoint authentication. Every
// protected /api/mobile/* route uses `getAuthenticatedMobileEmployee()`
// to validate the Supabase Bearer token and load the associated
// Account, Employee, and Company records.
//
// Authentication model
// --------------------
// Supabase is the ONLY authentication provider. The mobile app obtains
// an `access_token` (and `refresh_token`) from Supabase Auth, stores
// them securely on the device, and sends the access token on every
// request as `Authorization: Bearer <access_token>`. The backend
// validates the token via `supabase.auth.getUser(token)`, then loads
// the application Account by the token's `user.id` (== `authUserId`).
//
// This file does NOT generate, store, or sign custom JWTs. There is
// no application token system — Supabase access tokens are the only
// credentials the mobile app needs.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'
import type { Account, Company, Employee } from '@prisma/client'

// ── Public types ─────────────────────────────────────────────────────────

/**
 * Result of `getAuthenticatedMobileEmployee`. On success the helper
 * returns the four records needed to authorize a mobile request. On
 * failure it returns a ready-to-emit `NextResponse` with the proper
 * HTTP status and a consistent `{ success: false, error: { code, ... } }`
 * payload.
 */
export type MobileAuthResult =
  | {
      ok: true
      user: User
      account: Account
      employee: Employee
      company: Company
    }
  | { ok: false; response: NextResponse }

/** Shape returned to the mobile app from a successful login. */
export interface MobileAuthProfile {
  employeeId: string
  firstName: string
  lastName: string
  email: string
  avatarUrl: string | null
  company: { id: string; name: string; status: string }
  role: 'EMPLOYEE'
}

// ── Error response helpers ───────────────────────────────────────────────
// Local to this file so the contract is self-documenting. All mobile
// endpoints emit the same envelope: `{ success: false, error: { code,
// message, ... } }`.
function authError(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
) {
  return NextResponse.json(
    { success: false, error: { code, message, ...extra } },
    { status },
  )
}

// ── The helper ───────────────────────────────────────────────────────────

/**
 * Validates a Supabase Bearer token and loads the full mobile employee
 * context. Returns `{ ok: true, user, account, employee, company }` on
 * success, or `{ ok: false, response }` containing a ready-to-emit
 * `NextResponse` on failure.
 *
 * Failure modes (status | code):
 *   401 UNAUTHORIZED            no token, invalid token, or Supabase error
 *   403 ACCOUNT_DISABLED        Account.status !== 'ACTIVE'
 *   403 ROLE_NOT_ALLOWED        Account.role !== 'EMPLOYEE'
 *   404 EMPLOYEE_NOT_FOUND      no Employee row linked to the Account
 *   403 EMPLOYEE_INACTIVE       Employee.status !== 'ACTIVE' or soft-deleted
 *   403 COMPANY_INACTIVE        Company is CANCELLED / PAUSED / SUSPENDED / deleted
 *   500 INTERNAL                unexpected exception
 */
export async function getAuthenticatedMobileEmployee(
  request: NextRequest,
): Promise<MobileAuthResult> {
  try {
    // 1. Read and validate the Bearer token.
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : null

    if (!token) {
      return {
        ok: false,
        response: authError(401, 'UNAUTHORIZED', 'Missing Bearer token'),
      }
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.getUser(token)
    const user = data?.user ?? null

    if (error || !user || !user.email || !user.id) {
      return {
        ok: false,
        response: authError(401, 'UNAUTHORIZED', 'Invalid or expired token'),
      }
    }

    // 2. Find the application Account by Supabase user id.
    const account = await prisma.account.findUnique({
      where: { email: user.email },
    })
    if (!account) {
      return {
        ok: false,
        response: authError(
          403,
          'ACCOUNT_NOT_MAPPED',
          'You are not mapped to any account. Please contact your administrator.',
        ),
      }
    }
    if (account.status !== 'ACTIVE') {
      return {
        ok: false,
        response: authError(403, 'ACCOUNT_DISABLED', 'Account is inactive or suspended.'),
      }
    }

    // 3. Restrict to employee accounts.
    if (account.role !== 'EMPLOYEE') {
      return {
        ok: false,
        response: authError(
          403,
          'ROLE_NOT_ALLOWED',
          'This endpoint is only available for employee accounts.',
        ),
      }
    }

    // 4. Resolve the Employee via the canonical account relation.
    const employee = await prisma.employee.findFirst({
      where: { accountId: account.authUserId },
    })
    if (!employee) {
      return {
        ok: false,
        response: authError(
          404,
          'EMPLOYEE_NOT_FOUND',
          'No employee profile is linked to this account.',
        ),
      }
    }
    if (employee.status !== 'ACTIVE' || employee.deletedAt) {
      return {
        ok: false,
        response: authError(
          403,
          'EMPLOYEE_INACTIVE',
          'Your account is not active. Please contact your administrator.',
          { employeeStatus: employee.status },
        ),
      }
    }

    // 5. Load and validate the company.
    const company = await prisma.company.findUnique({
      where: { id: employee.companyId },
    })
    if (
      !company ||
      company.deletedAt ||
      company.status === 'CANCELLED' ||
      company.status === 'PAUSED' ||
      company.status === 'SUSPENDED'
    ) {
      return {
        ok: false,
        response: authError(
          403,
          'COMPANY_INACTIVE',
          "Your company's access is currently inactive.",
          { companyStatus: company?.status ?? 'UNKNOWN' },
        ),
      }
    }

    return { ok: true, user, account, employee, company }
  } catch (err) {
    console.error('getAuthenticatedMobileEmployee error:', err)
    return {
      ok: false,
      response: authError(500, 'INTERNAL', 'Internal server error'),
    }
  }
}

/**
 * Builds the standard mobile profile payload returned to the app after
 * a successful login. Centralized here so the shape cannot drift
 * between endpoints.
 */
export function buildMobileAuthProfile(
  account: Account,
  employee: Employee,
  company: Company,
): MobileAuthProfile {
  return {
    employeeId: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: account.email,
    avatarUrl: employee.avatarUrl,
    company: {
      id: company.id,
      name: company.name,
      status: company.status,
    },
    role: 'EMPLOYEE',
  }
}
