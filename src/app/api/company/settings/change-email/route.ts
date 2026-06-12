import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyAdmin, handleApiError } from '../../helpers'

export async function POST(request: NextRequest) {
  try {
    const { company, companyAdmin } = await getCompanyAdmin()
    const body = await request.json()
    const { newEmail, otp } = body

    if (!newEmail) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'New email is required' } },
        { status: 400 },
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_EMAIL', message: 'Invalid email address' } },
        { status: 400 },
      )
    }

    const existing = await prisma.companyAdmin.findUnique({ where: { email: newEmail.toLowerCase().trim() } })
    if (existing && existing.id !== companyAdmin.id) {
      return NextResponse.json(
        { success: false, error: { code: 'EMAIL_EXISTS', message: 'This email is already in use' } },
        { status: 409 },
      )
    }

    await prisma.$transaction([
      prisma.companyAdmin.update({
        where: { id: companyAdmin.id },
        data: { email: newEmail.toLowerCase().trim() },
      }),
      prisma.account.updateMany({
        where: { profileId: companyAdmin.id, profileType: 'COMPANY' },
        data: { email: newEmail.toLowerCase().trim() },
      }),
      prisma.auditLog.create({
        data: {
          actorType: 'COMPANY_ADMIN',
          companyId: company.id,
          action: 'EMAIL_CHANGED',
          entityType: 'COMPANY_ADMIN',
          entityId: companyAdmin.id,
          changes: { from: companyAdmin.email, to: newEmail.toLowerCase().trim() },
        },
      }),
    ])

    return NextResponse.json({ success: true, message: 'Email changed successfully' })
  } catch (error) {
    return handleApiError(error)
  }
}
