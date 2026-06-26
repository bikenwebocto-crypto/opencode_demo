import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'
import { getMerchantFromSession } from '@/lib/merchant-session'
import { createAuditLog } from '@/services/audit-log.service'

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
function internalError(error: unknown) {
  console.error('Merchant notifications prefs error:', error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 }
  )
}

interface NotificationPrefs {
  newRedemption: boolean
  offerApproval: boolean
  offerRejection: boolean
  profileChangeRequest: boolean
  issueResponse: boolean
  weeklyReport: boolean
  marketingEmails: boolean
}

const DEFAULT_PREFS: NotificationPrefs = {
  newRedemption: true,
  offerApproval: true,
  offerRejection: true,
  profileChangeRequest: true,
  issueResponse: true,
  weeklyReport: false,
  marketingEmails: false,
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'merchant') return unauthorized()
    const merchant = await getMerchantFromSession()
    if (!merchant) return notFound()
    const account = await prisma.account.findUnique({ where: { authUserId: merchant.accountId! }, select: { email: true } })

    return NextResponse.json({
      success: true,
      data: {
        email: account?.email ?? '',
        preferences: DEFAULT_PREFS,
      },
    })
  } catch (error) {
    return internalError(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'merchant') return unauthorized()
    const merchant = await getMerchantFromSession()
    if (!merchant) return notFound()
    const account = await prisma.account.findUnique({ where: { authUserId: merchant.accountId! }, select: { email: true } })

    const body = await request.json()
    const prefs = body?.preferences as Partial<NotificationPrefs> | undefined

    await createAuditLog({
      actorType: 'merchant',
      actorId: merchant.id,
      action: 'NOTIFICATION_PREFERENCES_UPDATED',
      entityType: 'merchant',
      entityId: merchant.id,
      changes: { preferences: prefs } as any,
    })

    return NextResponse.json({
      success: true,
      data: { email: account?.email ?? '', preferences: { ...DEFAULT_PREFS, ...(prefs ?? {}) } },
      message: 'Notification preferences updated',
    })
  } catch (error) {
    return internalError(error)
  }
}
