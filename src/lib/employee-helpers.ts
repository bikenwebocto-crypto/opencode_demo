// Mobile employee session helpers.
//
// Wraps `getEmployeeFromSession` from `@/lib/employee-session` with the
// additional `Employee.status === 'ACTIVE'` check that the web employee
// surfaces do not enforce. Also re-exports the standard response helpers
// (unauthorized, notFound, badRequest, internalError, companyInactive)
// so route files only need to import from one place, and adds the
// mobile-specific 403 case for inactive employees.
//
// All other auth (Supabase session, account.status, company status) is
// handled inside the underlying session helper — we only add the missing
// employee-level status check on top.

import { NextResponse } from 'next/server'
import {
  getEmployeeFromSession,
  unauthorized,
  notFound,
  badRequest,
  internalError,
  companyInactive,
  type EmployeeSession,
} from '@/lib/employee-session'
import type { EmployeeStatus } from '@prisma/client'

export type MobileEmployeeResult =
  | { ok: true; employee: EmployeeSession }
  | { ok: false; response: NextResponse }

export async function getActiveMobileEmployee(): Promise<MobileEmployeeResult> {
  const employee = await getEmployeeFromSession()
  console.log('employee helper:', employee);
  if (!employee) return { ok: false, response: unauthorized() }
  if ('inactive' in employee) {
    return { ok: false, response: companyInactive(employee.companyStatus) }
  }

  // Enforce `Employee.status === 'ACTIVE'`. The web helpers do not check
  // this — an INVITED/INACTIVE/SUSPENDED/INELIGIBLE employee would
  // otherwise be served content. Treats `soft-deleted` (deletedAt set) as
  // equivalent to INACTIVE.
  if (employee.status !== 'ACTIVE' || (employee as { deletedAt?: Date | null }).deletedAt) {
    return { ok: false, response: employeeInactive(employee.status) }
  }

  return { ok: true, employee }
}

export function employeeInactive(status: string) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'EMPLOYEE_INACTIVE',
        message: 'Your account is not active. Please contact your administrator.',
        employeeStatus: status,
      },
    },
    { status: 403 },
  )
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json(
    { success: false, error: { code: 'FORBIDDEN', message } },
    { status: 403 },
  )
}

// Convenience re-exports so route files only need one import path.
export {
  unauthorized,
  notFound,
  badRequest,
  internalError,
  companyInactive,
}
export type { EmployeeSession, EmployeeStatus }
