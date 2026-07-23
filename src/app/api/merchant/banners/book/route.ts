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

    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    if (days < banner.minDays) return badRequest(`Minimum booking period is ${banner.minDays} days`)
    if (days > banner.maxDays) return badRequest(`Maximum booking period is ${banner.maxDays} days`)

    const totalPrice = Number(banner.pricePerDay) * days

    const booking = await prisma.bannerBooking.create({
      data: {
        bannerId,
        merchantId: merchant.id,
        startDate: start,
        endDate: end,
        totalPrice,
        status: 'PENDING',
      },
    })

    await prisma.bannerContent.create({
      data: {
        bookingId: booking.id,
        imageUrl,
        altText,
        redirectUrl,
      },
    })

    const result = await prisma.bannerBooking.findUnique({
      where: { id: booking.id },
      include: {
        banner: { select: { id: true, name: true, position: true } },
        content: true,
      },
    })

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    return internalError(error)
  }
}
