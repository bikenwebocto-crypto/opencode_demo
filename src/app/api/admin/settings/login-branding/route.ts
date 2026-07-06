import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'
import { createAuditLog, fromCurrentUser } from '@/services/audit-log.service'
import { getAdminBranding, upsertBranding } from '@/features/admin/settings/login-branding/services/login-branding.service'
import { validateLoginBranding } from '@/features/admin/settings/login-branding/schemas/login-branding.schema'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const branding = await getAdminBranding()
    return NextResponse.json({ success: true, data: branding })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to load branding configuration' },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const validationError = validateLoginBranding(body)
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 },
      )
    }

    const branding = await upsertBranding(body)

    const changedFields = Object.keys(body)

    await createAuditLog(
      fromCurrentUser(user, 'LOGIN_BRANDING_UPDATED', 'LoginBranding', branding.id, {
        changes: changedFields,
      }),
    )

    return NextResponse.json({ success: true, data: branding })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to update branding configuration' },
      { status: 500 },
    )
  }
}
