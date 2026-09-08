import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'
import { requireRole } from '@/lib/api-auth'
import { createAuditLog } from '@/services/audit-log.service'
import { deleteImage } from '@/lib/upload/image'

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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireRole(['admin'])
    if (authResult instanceof NextResponse) return authResult
    const { user } = authResult

    const body = await request.json()
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (!reason) return badRequest('reason is required')

    const { id } = await params

    const booking = await prisma.bannerBooking.findFirst({
      where: { id },
      include: { content: true },
    })
    if (!booking) return notFound('Banner booking not found')

    if (booking.status !== 'APPROVED') {
      return badRequest('Only approved bookings can be deleted')
    }

    const imageUrl = booking.content?.imageUrl ?? null

    await prisma.bannerBooking.delete({ where: { id } })
    // BannerContent cascades via onDelete: Cascade — no manual child delete needed.

    void createAuditLog({
      actorType: 'admin',
      actorId: user.id,
      adminId: user.id,
      action: 'BANNER_BOOKING_DELETED',
      entityType: 'BANNER_BOOKING',
      entityId: id,
      metadata: { reason, deletedImageUrl: imageUrl },
    })

    if (imageUrl) {
      void deleteImage(imageUrl, { bucket: 'offer-images' }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return internalError(error)
  }
}
