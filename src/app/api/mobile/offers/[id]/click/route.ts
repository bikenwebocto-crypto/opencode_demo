import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { internalError, notFound, badRequest } from '@/lib/employee-helpers'
import { getAuthenticatedMobileEmployee } from '@/lib/mobile-auth'
import { createAuditLog } from '@/services/audit-log.service'

// POST /api/mobile/offers/[id]/click
//
// Records a "click" / "view" event for the offer. Increments
// `MerchantOffer.viewCount` so the "Most Popular" sort on the home feed
// can actually rank by it. Visibility is checked via the shared
// `liveOfferWhere` so suspended merchants or expired offers are rejected
// with a 400 (not silently accepted).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthenticatedMobileEmployee(request)
    if (!auth.ok) return auth.response

    const { id } = await params
    if (!id) return badRequest('Offer id is required')

    const now = new Date()
    const offer = await prisma.merchantOffer.findFirst({
      where: {
        id,
        status: 'LIVE',
        startDate: { lte: now },
        endDate: { gt: now },
        merchant: {
          status: 'ACTIVE',
          deletedAt: null,
          branches: { some: { isActive: true, status: 'ACTIVE', deletedAt: null } },
        },
      },
      select: { id: true, merchantId: true },
    })
    if (!offer) return notFound('Offer not found or not currently visible')

    await prisma.merchantOffer.update({
      where: { id: offer.id },
      data: { viewCount: { increment: 1 } },
    })

    // Audit log (fire-and-forget; never blocks the response)
    void createAuditLog({
      actorType: 'employee',
      actorId: auth.employee.id,
      action: 'OFFER_CLICKED',
      entityType: 'merchantOffer',
      entityId: offer.id,
      metadata: { merchantId: offer.merchantId, loginSource: 'mobile' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return internalError(error)
  }
}
