import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 }
  )
}

function internalError(error: unknown) {
  console.error('Admin bookings list API error:', error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 }
  )
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'admin') return unauthorized()

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20')))
    const status = searchParams.get('status') ?? undefined

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const [bookings, total] = await Promise.all([
      prisma.bannerBooking.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          banner: { select: { id: true, name: true, position: true } },
          merchant: { select: { id: true, businessName: true } },
          content: { select: { imageUrl: true, altText: true, redirectUrl: true } },
        },
      }),
      prisma.bannerBooking.count({ where: where as any }),
    ])

    return NextResponse.json({
      success: true,
      data: bookings,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page * pageSize < total,
        hasPreviousPage: page > 1,
      },
    })
  } catch (error) {
    return internalError(error)
  }
}
