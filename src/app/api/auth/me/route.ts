import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveAuthenticatedUser } from '@/lib/supabase/server'

export async function GET() {
  const resolved = await resolveAuthenticatedUser()
  if (!resolved) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let avatarUrl: string | null = null
  if (resolved.profileId) {
    switch (resolved.userType) {
      case 'admin': {
        const admin = await prisma.adminUser.findUnique({ where: { id: resolved.profileId }, select: { avatarUrl: true } })
        avatarUrl = admin?.avatarUrl ?? null
        break
      }
      case 'merchant': {
        const merchant = await prisma.merchant.findUnique({ where: { id: resolved.profileId }, select: { logoUrl: true } })
        avatarUrl = merchant?.logoUrl ?? null
        break
      }
      case 'employee': {
        const employee = await prisma.employee.findUnique({ where: { id: resolved.profileId }, select: { avatarUrl: true } })
        avatarUrl = employee?.avatarUrl ?? null
        break
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      id: resolved.id,
      email: resolved.email,
      name: resolved.name,
      userType: resolved.userType,
      role: resolved.role,
      avatarUrl,
    },
  })
}
