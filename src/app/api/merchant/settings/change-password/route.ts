import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { getCurrentUser } from '@/lib/session'
import { getMerchantFromSession } from '@/lib/merchant-session'

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 }
  )
}
function notFound() {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } },
    { status: 404 }
  )
}
function badRequest(message: string) {
  return NextResponse.json(
    { success: false, error: { code: 'VALIDATION', message } },
    { status: 400 }
  )
}
function internalError(error: unknown) {
  console.error('Change password error:', error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 }
  )
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'merchant') return unauthorized()
    const merchant = await getMerchantFromSession()
    if (!merchant) return notFound()

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return badRequest('Current password and new password are required')
    }
    if (newPassword.length < 8) {
      return badRequest('New password must be at least 8 characters')
    }

    const valid = await bcrypt.compare(currentPassword, merchant.passwordHash)
    if (!valid) return badRequest('Current password is incorrect')

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.merchant.update({
      where: { id: merchant.id },
      data: { passwordHash: hashed },
    })

    await prisma.auditLog.create({
      data: {
        actorType: 'MERCHANT',
        merchantId: merchant.id,
        action: 'PASSWORD_CHANGED',
        entityType: 'merchant',
        entityId: merchant.id,
      },
    })

    return NextResponse.json({ success: true, message: 'Password changed successfully' })
  } catch (error) {
    return internalError(error)
  }
}
