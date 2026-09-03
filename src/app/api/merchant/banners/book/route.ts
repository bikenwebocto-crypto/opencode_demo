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
  console.error('Merchant book banner API error:', error)
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
    const { bannerId, startDate, endDate, imageUrl, altText, redirectUrl } = body

    if (!bannerId || !startDate || !endDate || !imageUrl) {
      return badRequest('bannerId, startDate, endDate, and imageUrl are required')
    }

    const banner = await prisma.banner.findUnique({ where: { id: bannerId } })
    if (!banner) return badRequest('Banner slot not found')
    if (!banner.isActive) return badRequest('Banner slot is not active')

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return badRequest('Invalid date format')
    }

    if (start >= end) return badRequest('End date must be after start date')

    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    if (days < banner.minDays) return badRequest(`Minimum booking period is ${banner.minDays} days`)
    if (days > banner.maxDays) return badRequest(`Maximum booking period is ${banner.maxDays} days`)

    if (banner.expiresAt && end > banner.expiresAt) {
      return badRequest(`Booking cannot extend beyond banner expiry (${banner.expiresAt.toLocaleDateString()})`)
    }

    const overlapping = await prisma.bannerBooking.findFirst({
      where: {
        bannerId,
        status: 'APPROVED',
        paid: true,
        startDate: { lt: end },
        endDate: { gt: start },
      },
    })
    if (overlapping) {
      return badRequest('This banner slot is already booked for the requested dates')
    }

    const positionSlots = await prisma.banner.findMany({
      where: { position: banner.position, isActive: true },
      select: { id: true },
    })
    const bookedSlotIds = await prisma.bannerBooking.findMany({
      where: {
        bannerId: { in: positionSlots.map((s) => s.id) },
        status: 'APPROVED',
        paid: true,
        startDate: { lt: end },
        endDate: { gt: start },
      },
      select: { bannerId: true },
    })
    if (bookedSlotIds.length >= positionSlots.length) {
      return badRequest(
        `All ${banner.position} slots are booked for these dates. Please choose different dates or check back later.`,
      )
    }

    const totalPrice = Number(banner.pricePerDay) * days

    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.bannerBooking.create({
        data: {
          bannerId,
          merchantId: merchant.id,
          startDate: start,
          endDate: end,
          totalPrice,
          status: 'PENDING',
        },
      })

      await tx.bannerContent.create({
        data: {
          bookingId: booking.id,
          imageUrl,
          altText,
          redirectUrl,
        },
      })

      return tx.bannerBooking.findUnique({
        where: { id: booking.id },
        include: {
          banner: { select: { id: true, name: true, position: true } },
          content: true,
        },
      })
    })

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    return internalError(error)
  }
}
