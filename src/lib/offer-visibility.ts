// Centralized business rules for the employee offer visibility flow.
// Used by: /api/employee/offers, /api/employee/offers/[id], /api/employee/redeem
//
// Rules:
// 1. offer.status = 'LIVE'
// 2. offer.startDate <= now
// 3. offer.endDate > now
// 4. merchant.status = 'ACTIVE' (and not deleted)
// 5. merchant has at least one active branch (or an ONLINE branch if delivery/digital only)
//
// Note: per-employee redemption limit is enforced at redemption time (not at
// visibility time) by counting the employee's existing redemptions for the offer.

import { prisma } from '@/lib/prisma'

export interface OfferVisibilityResult {
  visible: boolean
  reason?: string
}

export async function isOfferVisibleToEmployees(
  offerId: string
): Promise<OfferVisibilityResult> {
  const offer = await prisma.merchantOffer.findUnique({
    where: { id: offerId },
    include: {
      merchant: {
        include: {
          branches: { where: { deletedAt: null } },
        },
      },
    },
  })
  if (!offer) return { visible: false, reason: 'Offer not found' }
  if (offer.status !== 'LIVE') return { visible: false, reason: 'Offer is not live' }
  const now = new Date()
  if (offer.startDate > now) return { visible: false, reason: 'Offer has not started yet' }
  if (offer.endDate <= now) return { visible: false, reason: 'Offer has expired' }
  if (offer.merchant.status !== 'ACTIVE') {
    return { visible: false, reason: 'Merchant is not active' }
  }
  if (offer.merchant.deletedAt) {
    return { visible: false, reason: 'Merchant no longer exists' }
  }
  const hasActiveBranch = offer.merchant.branches.some((b) => b.isActive && b.status === 'ACTIVE')
  const hasOnlineBranch = offer.merchant.branches.some(
    (b) => b.branchType === 'ONLINE' && b.status === 'ACTIVE'
  )
  if (!hasActiveBranch && !hasOnlineBranch) {
    return { visible: false, reason: 'Merchant has no active branches' }
  }
  return { visible: true }
}

export interface RedemptionEligibility {
  eligible: boolean
  reason?: string
}

export async function checkRedemptionEligibility(
  offerId: string,
  employeeId: string
): Promise<RedemptionEligibility> {
  const visibility = await isOfferVisibleToEmployees(offerId)
  if (!visibility.visible) return { eligible: false, reason: visibility.reason }

  const offer = await prisma.merchantOffer.findUnique({ where: { id: offerId } })
  if (!offer) return { eligible: false, reason: 'Offer not found' }

  if (offer.maxRedemptions != null && offer.currentRedemptions >= offer.maxRedemptions) {
    return { eligible: false, reason: 'Offer usage limit reached' }
  }

  const employeeRedemptions = await prisma.redemption.count({
    where: { offerId, employeeId },
  })
  if (employeeRedemptions > 0) {
    return { eligible: false, reason: 'You have already redeemed this offer' }
  }

  return { eligible: true }
}

export function generateRedemptionCode(): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `RED-${ts}-${rand}`
}
