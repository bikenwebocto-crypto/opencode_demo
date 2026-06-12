import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as bcrypt from 'bcryptjs'
import { getCompanyAdmin, handleApiError } from '../../helpers'

export async function POST(request: NextRequest) {
  try {
    const { company, companyAdmin } = await getCompanyAdmin()
    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Current password and new password are required' } },
        { status: 400 },
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'New password must be at least 8 characters' } },
        { status: 400 },
      )
    }

    const valid = await bcrypt.compare(currentPassword, companyAdmin.passwordHash)
    if (!valid) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } },
        { status: 400 },
      )
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)

    await prisma.$transaction([
      prisma.companyAdmin.update({
        where: { id: companyAdmin.id },
        data: { passwordHash },
      }),
      prisma.auditLog.create({
        data: {
          actorType: 'COMPANY_ADMIN',
          companyId: company.id,
          action: 'PASSWORD_CHANGED',
          entityType: 'COMPANY_ADMIN',
          entityId: companyAdmin.id,
        },
      }),
    ])

    return NextResponse.json({ success: true, message: 'Password changed successfully' })
  } catch (error) {
    return handleApiError(error)
  }
}
