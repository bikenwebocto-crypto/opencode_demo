import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getEmployeeFromSession,
  unauthorized,
  notFound,
  internalError,
} from '@/lib/employee-session'
import { isOfferVisibleToEmployees } from '@/lib/offer-visibility'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const employee = await getEmployeeFromSession()
    if (!employee) return unauthorized()
    const { id } = await params

    const offer = await prisma.merchantOffer.findUnique({
      where: { id },
      include: {
        merchant: {
          include: {
            category: { select: { id: true, name: true, icon: true } },
            branches: { where: { deletedAt: null, status: 'ACTIVE' } },
          },
        },
        _count: { select: { redemptions: true } },
      },
    })
    if (!offer) return notFound('Offer not found')

    const visibility = await isOfferVisibleToEmployees(id)
    const [saved, redeemed] = await Promise.all([
      prisma.notificationEvent.findFirst({
        where: { employeeId: employee.id, referenceType: 'saved_offer', referenceId: id },
        select: { id: true },
      }),
      prisma.redemption.findFirst({
        where: { employeeId: employee.id, offerId: id },
        select: { id: true },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        ...offer,
        isVisible: visibility.visible,
        visibilityReason: visibility.reason,
        isSaved: !!saved,
        isRedeemed: !!redeemed,
      },
    })
  } catch (error) {
    return internalError(error)
  }
}
