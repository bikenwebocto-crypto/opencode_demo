import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getEmployeeFromSession,
  unauthorized,
  notFound,
  badRequest,
  internalError,
} from '@/lib/employee-session'

export async function GET(_request: NextRequest) {
  try {
    const employee = await getEmployeeFromSession()
    if (!employee) return unauthorized()

    const saved = await prisma.notificationEvent.findMany({
      where: {
        employeeId: employee.id,
        referenceType: 'saved_offer',
      },
      orderBy: { createdAt: 'desc' },
    })

    const offerIds = saved
      .map((s) => s.referenceId)
      .filter((id): id is string => !!id)

    const offers = offerIds.length
      ? await prisma.merchantOffer.findMany({
          where: { id: { in: offerIds } },
          include: {
            merchant: {
              select: {
                id: true,
                businessName: true,
                logoUrl: true,
                averageRating: true,
                city: true,
                state: true,
              },
            },
          },
        })
      : []

    const offerMap = new Map(offers.map((o) => [o.id, o]))
    const result = saved
      .map((s) => {
        const offer = s.referenceId ? offerMap.get(s.referenceId) : null
        if (!offer) return null
        return {
          savedAt: s.createdAt,
          notificationId: s.id,
          offer,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return internalError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const employee = await getEmployeeFromSession()
    if (!employee) return unauthorized()
    const body = await request.json()
    const offerId: string | undefined = body?.offerId
    if (!offerId) return badRequest('offerId is required')

    const offer = await prisma.merchantOffer.findUnique({ where: { id: offerId } })
    if (!offer) return notFound('Offer not found')

    const existing = await prisma.notificationEvent.findFirst({
      where: {
        employeeId: employee.id,
        referenceType: 'saved_offer',
        referenceId: offerId,
      },
    })
    if (existing) {
      return NextResponse.json({ success: true, data: { id: existing.id }, message: 'Already saved' })
    }

    const saved = await prisma.notificationEvent.create({
      data: {
        recipientType: 'EMPLOYEE',
        employeeId: employee.id,
        title: `Saved: ${offer.title}`,
        body: `You saved "${offer.title}".`,
        channel: 'IN_APP',
        priority: 'LOW',
        referenceType: 'saved_offer',
        referenceId: offerId,
        isRead: true,
      },
    })

    await prisma.merchantOffer.update({
      where: { id: offerId },
      data: { saveCount: { increment: 1 } },
    })

    return NextResponse.json({ success: true, data: { id: saved.id } }, { status: 201 })
  } catch (error) {
    return internalError(error)
  }
}
