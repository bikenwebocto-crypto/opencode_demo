import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  internalError,
  notFound,
  badRequest,
} from '@/lib/employee-helpers'
import { getAuthenticatedMobileEmployee } from '@/lib/mobile-auth'
import {
  checkRedemptionEligibility,
  generateRedemptionCode,
} from '@/lib/offer-visibility'
import {
  encodeMethod,
  REDEMPTION_METHODS,
  type RedemptionMethod,
} from '@/lib/redemption-status'
import { createAuditLog } from '@/services/audit-log.service'

// POST /api/mobile/offers/[id]/redeem
//
// Mirrors the web `/api/employee/redeem` POST handler 1:1 so the mobile
// app gets identical redemption semantics (eligibility check via
// `checkRedemptionEligibility`, branch validation, code generation, audit
// log, view count increment).
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
    const { method, branchId, notes, spentAmount } = body ?? {}

    if (!method || !REDEMPTION_METHODS.includes(method as RedemptionMethod)) {
      return badRequest(`method must be one of: ${REDEMPTION_METHODS.join(', ')}`)
    }

    const eligibility = await checkRedemptionEligibility(offerId, auth.employee.id)
    if (!eligibility.eligible) {
      return badRequest(eligibility.reason ?? 'Not eligible to redeem this offer')
    }

    const offer = await prisma.merchantOffer.findUnique({ where: { id: offerId } })
    if (!offer) return notFound('Offer not found')

    let validBranchId: string | null = null
    if (branchId) {
      const branch = await prisma.merchantBranch.findFirst({
        where: { id: branchId, merchantId: offer.merchantId, deletedAt: null },
      })
      if (!branch) return badRequest('Invalid branchId for this offer')
      validBranchId = branch.id
    }

    const redemptionCode = generateRedemptionCode()
    const discountAmount = Number(offer.discountValue ?? 0)
    const spent = spentAmount ? Number(spentAmount) : 0
    const savings = method === 'IN_STORE' ? discountAmount : Math.max(0, discountAmount - spent)

    const redemption = await prisma.redemption.create({
      data: {
        merchantId: offer.merchantId,
        offerId: offer.id,
        employeeId: auth.employee.id,
        companyId: auth.employee.companyId,
        redemptionCode,
        discountAmount,
        spentAmount: spent || null,
        savingsAmount: savings,
        branchId: validBranchId,
        merchantNotes: encodeMethod(method as RedemptionMethod),
        employeeNotes: notes ?? null,
        isVerified: false,
        redeemedAt: new Date(),
      },
    })

    // Keep the home feed's "Most Popular" sort honest. `viewCount` is
    // incremented by the `/click` endpoint normally; this guards against
    // a no-op when the redemption flow is the only thing the user did.
    await prisma.merchantOffer.update({
      where: { id: offerId },
      data: {
        currentRedemptions: { increment: 1 },
        viewCount: { increment: 0 },
      },
    })

    void createAuditLog({
      actorType: 'employee',
      actorId: auth.employee.id,
      action: 'REDEMPTION_CREATED',
      entityType: 'redemption',
      entityId: redemption.id,
      metadata: { offerId, merchantId: offer.merchantId, method, branchId: validBranchId, loginSource: 'mobile' },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: redemption.id,
          redemptionCode: redemption.redemptionCode,
          method,
          status: 'PENDING',
          message: 'Redemption submitted. Show this code to the merchant.',
        },
      },
      { status: 201 },
    )
  } catch (error) {
    return internalError(error)
  }
}
