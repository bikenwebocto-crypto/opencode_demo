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

function badRequest(message: string) {
  return NextResponse.json(
    { success: false, error: { code: 'VALIDATION', message } },
    { status: 400 }
  )
}

function internalError(error: unknown) {
  console.error('Admin booking review API error:', error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 }
  )
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'admin') return unauthorized()

    const { id } = await params
    const booking = await prisma.bannerBooking.findUnique({ where: { id } })
    if (!booking) return notFound('Booking')

    const body = await request.json()
    const { status, rejectedReason } = body

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return badRequest('Status must be APPROVED or REJECTED')
    }

    if (booking.status !== 'PENDING') {
      return badRequest('Booking is already processed')
    }

    const updates: Record<string, unknown> = { status }

    if (status === 'APPROVED') {
      updates.approvedBy = user.id
      updates.approvedAt = new Date()
      updates.paid = true
    }

    if (status === 'REJECTED' && rejectedReason) {
      updates.rejectedReason = rejectedReason
    }

    const updated = await prisma.bannerBooking.update({
      where: { id },
      data: updates,
      include: {
        banner: { select: { id: true, name: true, position: true } },
        merchant: { select: { id: true, businessName: true } },
        content: true,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return internalError(error)
  }
}
