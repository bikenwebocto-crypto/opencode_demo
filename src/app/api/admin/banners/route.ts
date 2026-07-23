import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 }
  )
}

function notFound(entity: string) {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: `${entity} not found` } },
    { status: 404 }
  )
}

function internalError(error: unknown) {
  console.error('Admin banners API error:', error)
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

    const [banners, total] = await Promise.all([
      prisma.banner.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { bookings: true } } },
      }),
      prisma.banner.count(),
    ])

    return NextResponse.json({
      success: true,
      data: banners,
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

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'admin') return unauthorized()

    const body = await request.json()
    const { name, description, position, pricePerDay, minDays, maxDays } = body

    if (!name || !position || pricePerDay === undefined) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'name, position, and pricePerDay are required' } },
        { status: 400 }
      )
    }

    const banner = await prisma.banner.create({
      data: {
        name,
        description,
        position,
        pricePerDay: parseFloat(pricePerDay),
        minDays: minDays ?? 7,
        maxDays: maxDays ?? 30,
      },
    })

    return NextResponse.json({ success: true, data: banner }, { status: 201 })
  } catch (error) {
    return internalError(error)
  }
}
