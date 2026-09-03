import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'
import { getMerchantFromSession } from '@/lib/merchant-session'

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 }
  )
}

function notFound(message: string) {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message } },
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
  console.error('Merchant banner slots API error:', error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 }
  )
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'merchant') return unauthorized()
    const merchant = await getMerchantFromSession()
    if (!merchant) return notFound('Merchant not found')

    const { searchParams } = new URL(request.url)
    const position = searchParams.get('position')
    if (!position) return badRequest('position is required')

    const now = new Date()

    const banner = await prisma.banner.findFirst({
      where: {
        position,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    })

    if (!banner) return notFound('No active banner slot for this position')

    const activeBookings = await prisma.bannerBooking.findMany({
      where: {
        bannerId: banner.id,
        status: { in: ['PENDING', 'APPROVED'] },
        endDate: { gte: now },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        merchant: { select: { businessName: true } },
        content: { select: { imageUrl: true, altText: true, redirectUrl: true } },
      },
    })

    const slots = Array.from({ length: banner.slotCount }, (_, i) => {
      const booking = activeBookings[i]
      if (!booking) {
        return { slotNumber: i + 1, status: 'AVAILABLE' as const }
      }
      return {
        slotNumber: i + 1,
        status: booking.status as 'PENDING' | 'APPROVED',
        bookingId: booking.id,
        startDate: booking.startDate,
        bookedUntil: booking.endDate,
        merchantName: booking.merchant.businessName,
        isOwnBooking: booking.merchantId === merchant.id,
        content: booking.content,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        bannerId: banner.id,
        position: banner.position,
        pricePerDay: banner.pricePerDay,
        minDays: banner.minDays,
        maxDays: banner.maxDays,
        slotCount: banner.slotCount,
        availableCount: banner.slotCount - activeBookings.length,
        slots,
      },
    })
  } catch (error) {
    return internalError(error)
  }
}