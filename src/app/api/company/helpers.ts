import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { NextResponse } from 'next/server'

export async function getCompanyAdmin() {
  const user = await getCurrentUser()
  if (!user || user.userType !== 'company_admin') {
    throw new AuthError('Unauthorized')
  }

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

  return { company, companyAdmin, user }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: error.message } },
      { status: 401 },
    )
  }
  console.error('API error:', error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 },
  )
}
