import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export class CompanyInactiveError extends Error {
  code = 'COMPANY_INACTIVE'
  constructor(public companyStatus: string) {
    super(`Your company's access is currently inactive.`)
    this.name = 'CompanyInactiveError'
  }
}

export async function getCompanyAdmin() {
  const user = await getCurrentUser()
  if (!user || user.userType !== 'company_admin') {
    throw new AuthError('Unauthorized')
  }

  if (!user.profileId) throw new AuthError('Unauthorized')
  const companyAdmin = await prisma.companyAdmin.findUnique({
    where: { id: user.profileId },
  })
  if (!companyAdmin || !companyAdmin.isActive) {
    throw new AuthError('Company admin account not found or inactive')
  }

  const company = await prisma.company.findUnique({
    where: { id: companyAdmin.companyId },
  })
  if (!company || company.deletedAt || company.status === 'CANCELLED') {
    throw new AuthError('Company not found or inactive')
  }

  // Non-payment cascade: if the company is paused or suspended, the
  // company admin loses platform access.
  if (company.status === 'PAUSED' || company.status === 'SUSPENDED') {
    throw new CompanyInactiveError(company.status)
  }

  return { company, companyAdmin, user }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: error.message } },
      { status: 401 },
    )
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: error.message } },
      { status: 403 },
    )
  }
  if (error instanceof CompanyInactiveError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'COMPANY_INACTIVE',
          message: `Your company's access is currently inactive.`,
          companyStatus: error.companyStatus,
        },
      },
      { status: 403 },
    )
  }
  // Handle Prisma unique constraint violations
  if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
    const prismaError = error as any
    const target = prismaError.meta?.target
    // Email uniqueness is now on Account only (removed from profile tables)
    if (Array.isArray(target) && target.includes('email')) {
      return NextResponse.json(
        { success: false, error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Email is already assigned to another account' } },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { success: false, error: { code: 'DUPLICATE_ENTRY', message: 'A record with this information already exists' } },
      { status: 409 },
    )
  }
  console.error('API error:', error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 },
  )
}
