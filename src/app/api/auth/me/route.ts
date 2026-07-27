import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveAuthenticatedUser } from '@/lib/supabase/server'
import { createPerfTimer } from '@/lib/perf'

export async function GET() {
  const timer = createPerfTimer('GET /api/auth/me')
  timer.section('Authentication')
  try {
    timer.point('resolveAuthenticatedUser (calls getCurrentUser)')
    const resolved = await resolveAuthenticatedUser()
    if (!resolved) {
      timer.end()
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    timer.section('Database Queries')
    let avatarUrl: string | null = null
    if (resolved.profileId) {
      switch (resolved.userType) {
        case 'admin': {
          timer.point('adminUser.findUnique (avatarUrl)')
          const admin = await prisma.adminUser.findUnique({ where: { id: resolved.profileId }, select: { avatarUrl: true } })
          avatarUrl = admin?.avatarUrl ?? null
          break
        }
        case 'merchant': {
          timer.point('merchant.findUnique (logoUrl)')
          const merchant = await prisma.merchant.findUnique({ where: { id: resolved.profileId }, select: { logoUrl: true } })
          avatarUrl = merchant?.logoUrl ?? null
          break
        }
        case 'employee': {
          timer.point('employee.findUnique (avatarUrl)')
          const employee = await prisma.employee.findUnique({ where: { id: resolved.profileId }, select: { avatarUrl: true } })
          avatarUrl = employee?.avatarUrl ?? null
          break
        }
      }
    }

    timer.section('Serialization')
    timer.point('NextResponse.json')
    timer.end()
    return NextResponse.json({
      success: true,
      data: {
        id: resolved.id,
        email: resolved.email,
        name: resolved.name,
        userType: resolved.userType,
        role: resolved.role,
        companyName: resolved.companyName,
        avatarUrl,
      },
    })
  } catch (error) {
    timer.end()
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
}
