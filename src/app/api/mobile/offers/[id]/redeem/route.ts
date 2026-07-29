import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { internalError, notFound, badRequest } from '@/lib/employee-helpers'
import { getAuthenticatedMobileEmployee } from '@/lib/mobile-auth'
import { checkRedemptionEligibility } from '@/lib/offer-visibility'
import { encodeMethod } from '@/lib/redemption-status'
import { createAuditLog } from '@/services/audit-log.service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthenticatedMobileEmployee(request)
    if (!auth.ok) return auth.response
    const { id: offerId } = await params
    if (!offerId) return badRequest('Offer id is required')

    const body = await request.json()
    const { branchId, notes, spentAmount } = body ?? {}

    const eligibility = await checkRedemptionEligibility(offerId, auth.employee.id)
    if (!eligibility.eligible) {
      return badRequest(eligibility.reason ?? 'Not eligible to redeem this offer')
    }

    const offer = await prisma.merchantOffer.findFirst({
      where: { id: offerId, deletedAt: null },
      include: {
        merchant: { select: { id: true, businessName: true, website: true } },
        pricing: { select: { configuration: true } },
        redemption: { select: { redemptionType: true, configuration: true } },
      },
    })
    if (!offer) return notFound('Offer not found')

    const redemptionType = offer.redemption?.redemptionType ?? null
    if (!redemptionType) {
      return badRequest('This offer does not have a redemption type configured')
    }

    const pricingConfig = (offer.pricing?.configuration as Record<string, unknown>) ?? {}
    const redemptionConfig = (offer.redemption?.configuration as Record<string, unknown>) ?? {}

    let validBranch: any = null
    if (branchId) {
      const branch = await prisma.merchantBranch.findFirst({
        where: { id: branchId, merchantId: offer.merchantId, deletedAt: null },
      })
      if (!branch) return badRequest('Invalid branchId for this offer')
      validBranch = branch
    }
    if (redemptionType === 'IN_STORE_QR' && !validBranch) {
      return badRequest('Branch is required for in-store QR redemptions')
    }

    if (redemptionType === 'ONLINE_CODE' && !redemptionConfig.code) {
      return badRequest('This offer does not have a valid offer code')
    }
    if (redemptionType === 'BOOKING_LINK' && !redemptionConfig.bookingUrl) {
      return badRequest('This offer does not have a booking link')
    }

    const discountAmount = Number(pricingConfig.amount ?? pricingConfig.percent ?? 0)
    const spent = spentAmount ? Number(spentAmount) : 0
    const savings = redemptionType === 'IN_STORE_QR' ? discountAmount : Math.max(0, discountAmount - spent)

    const status = redemptionType === 'IN_STORE_QR' ? 'PENDING' : 'CONFIRMED'

    const method = redemptionType === 'ONLINE_CODE' ? 'ONLINE' as const
      : redemptionType === 'BOOKING_LINK' ? 'ONLINE' as const
      : 'IN_STORE' as const

    const redemption = await prisma.redemption.create({
      data: {
        merchantId: offer.merchantId,
        offerId: offer.id,
        employeeId: auth.employee.id,
        companyId: auth.employee.companyId,
        discountAmount,
        spentAmount: spent || null,
        savingsAmount: savings,
        branchId: validBranch?.id ?? null,
        merchantNotes: encodeMethod(method),
        employeeNotes: notes ?? null,
        isVerified: status === 'CONFIRMED',
        verifiedAt: status === 'CONFIRMED' ? new Date() : null,
        redeemedAt: new Date(),
      },
    })

    await prisma.offerRedemption.update({
      where: { offerId },
      data: { currentRedemptions: { increment: 1 } },
    })

    await prisma.offerAnalytics.upsert({
      where: { offerId },
      create: { offerId, clickCount: 1 },
      update: { clickCount: { increment: 1 } },
    })

    void createAuditLog({
      actorType: 'employee',
      actorId: auth.employee.id,
      action: `REDEMPTION_CREATED_${redemptionType}`,
      entityType: 'redemption',
      entityId: redemption.id,
      metadata: {
        offerId,
        merchantId: offer.merchantId,
        method,
        branchId: validBranch?.id ?? null,
        redemptionType,
        offerCode: redemptionType === 'ONLINE_CODE' ? redemptionConfig.code : null,
        loginSource: 'mobile',
      },
    })

    const data: Record<string, unknown> = { id: redemption.id, type: redemptionType, status }

    if (redemptionType === 'IN_STORE_QR' && validBranch) {
      const lat = validBranch.latitude ? Number(validBranch.latitude) : null
      const lng = validBranch.longitude ? Number(validBranch.longitude) : null
      data.merchant = { businessName: offer.merchant.businessName, website: offer.merchant.website }
      data.branch = {
        name: validBranch.name,
        addressLine1: validBranch.addressLine1,
        addressLine2: validBranch.addressLine2,
        city: validBranch.city,
        state: validBranch.state,
        postalCode: validBranch.postalCode,
        phone: validBranch.phone,
        latitude: lat,
        longitude: lng,
        openingHours: validBranch.openingHours,
        googleMapsUrl: lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null,
      }
      data.instructions = redemptionConfig.instructions ?? null
    }

    if (redemptionType === 'ONLINE_CODE') {
      data.offerCode = redemptionConfig.code ?? null
      data.merchantWebsite = redemptionConfig.bookingUrl ?? null
      data.instructions = redemptionConfig.instructions ?? null
    }

    if (redemptionType === 'BOOKING_LINK') {
      data.bookingUrl = redemptionConfig.bookingUrl ?? null
      data.instructions = redemptionConfig.instructions ?? null
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    return internalError(error)
  }
}
