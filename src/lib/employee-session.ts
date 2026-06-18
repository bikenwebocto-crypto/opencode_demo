import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'

export interface EmployeeSession {
  id: string
  email: string
  firstName: string
  lastName: string
  companyId: string
  status: string
  jobTitle: string | null
  department: string | null
  avatarUrl: string | null
  phone: string | null
  employeeId: string | null
  companyStatus?: string
}

export interface InactiveCompanySentinel {
  inactive: true
  companyStatus: string
  message: string
}

export type EmployeeSessionResult = EmployeeSession | InactiveCompanySentinel | null

export async function getEmployeeFromSession(): Promise<EmployeeSessionResult> {
  const user = await getCurrentUser()
  if (!user || user.userType !== 'employee' || !user.profileId) return null
  const emp = await prisma.employee.findUnique({ where: { id: user.profileId } })
  if (!emp) return null

  // Non-payment cascade: if the company is paused/suspended/cancelled,
  // the employee loses platform access.
  const company = await prisma.company.findUnique({
    where: { id: emp.companyId },
    select: { id: true, status: true, deletedAt: true },
  })
  if (!company || company.deletedAt || company.status === 'CANCELLED') {
    return null
  }
  if (company.status === 'PAUSED' || company.status === 'SUSPENDED') {
    return {
      inactive: true,
      companyStatus: company.status,
      message: `Your company's access is currently inactive.`,
    }
  }

  return {
    id: emp.id,
    email: emp.email,
    firstName: emp.firstName,
    lastName: emp.lastName,
    companyId: emp.companyId,
    status: emp.status,
    jobTitle: emp.jobTitle,
    department: emp.department,
    avatarUrl: emp.avatarUrl,
    phone: emp.phone,
    employeeId: emp.employeeId,
    companyStatus: company.status,
  }
}

export function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 }
  )
}

export function notFound(message = 'Not found') {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message } },
    { status: 404 }
  )
}

export function badRequest(message: string, details?: Record<string, string>) {
  return NextResponse.json(
    { success: false, error: { code: 'VALIDATION', message, details } },
    { status: 400 }
  )
}

export function companyInactive(companyStatus: string) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'COMPANY_INACTIVE',
        message: `Your company's access is currently inactive.`,
        companyStatus,
      },
    },
    { status: 403 }
  )
}

export function internalError(error: unknown) {
  console.error('Employee API error:', error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 }
  )
}
