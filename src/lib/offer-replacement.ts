/**
 * Offer replacement business rules.
 *
 * Per the spec:
 *   1. Only LIVE offers can be replaced.
 *   2. Only one pending replacement request per LIVE offer at a time.
 *   3. A replacement cannot itself create another replacement (no chains).
 *   4. After admin approval, the merchant must have exactly one LIVE offer.
 *
 * Status flow:
 *   LIVE → REPLACEMENT_PENDING (when a new offer is submitted as replacement)
 *      ├── APPROVE   → old: ARCHIVED, new: LIVE
 *      ├── REJECT    → old: LIVE (unchanged), new: REJECTED
 *      └── REQUEST_CHANGES → old: LIVE (unchanged), new: CHANGES_REQUESTED
 *
 * "REPLACEMENT_PENDING" is not a new OfferStatus value — we reuse the
 * queue item's `PENDING` status to track it. The merchant-visible
 * state is derived from the existence of an OfferReplacementRequest
 * with status='PENDING' or 'AWAITING_APPROVAL' pointing at this offer.
 */

import type { OfferStatus, ReplacementStatus } from '@/types'

/** Statuses that count as "a replacement is currently in flight" for
 *  the purpose of blocking a second replacement. */
export const PENDING_REPLACEMENT_STATUSES: ReplacementStatus[] = [
  'PENDING',
  'AWAITING_APPROVAL',
]

/** The set of offer statuses that block a new replacement. */
export const STATUSES_BLOCKING_REPLACEMENT: OfferStatus[] = [
  'DRAFT',
  'ARCHIVED',
  'REJECTED',
  'AWAITING_APPROVAL',
  'VALIDATION_IN_PROGRESS',
  'CHANGES_REQUESTED',
  'REPLACED',
  'EXPIRED',
  'PENDING_APPROVAL',
]

export class ReplacementValidationError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'ReplacementValidationError'
    this.code = code
  }
}

interface TargetOfferLite {
  id: string
  status: OfferStatus
  merchantId: string
  isReplacement: boolean
  replacesOfferId: string | null
}

interface ExistingRequestLite {
  id: string
  status: ReplacementStatus
  newOfferId: string
  currentOfferId: string
}

/**
 * Validate that a new replacement can be created.
 * Throws ReplacementValidationError on failure.
 */
export async function validateReplacement(
  prisma: any,
  args: {
    merchantId: string
    targetOfferId: string
  },
): Promise<{ target: TargetOfferLite }> {
  const target = await prisma.merchantOffer.findUnique({
    where: { id: args.targetOfferId },
    select: {
      id: true,
      status: true,
      merchantId: true,
      isReplacement: true,
      replacesOfferId: true,
    },
  })

  if (!target) {
    throw new ReplacementValidationError(
      'TARGET_NOT_FOUND',
      'The offer you are trying to replace does not exist.',
    )
  }

  if (target.merchantId !== args.merchantId) {
    throw new ReplacementValidationError(
      'TARGET_NOT_OWNED',
      'You can only replace your own offers.',
    )
  }

  // Rule 3: A replacement cannot itself create another replacement.
  if (target.isReplacement) {
    throw new ReplacementValidationError(
      'CHAIN_NOT_ALLOWED',
      'A replacement offer cannot create another replacement until approved.',
    )
  }

  // Rule 1: Only LIVE offers can be replaced.
  if (STATUSES_BLOCKING_REPLACEMENT.includes(target.status)) {
    throw new ReplacementValidationError(
      'TARGET_NOT_LIVE',
      'Only live offers can be replaced.',
    )
  }

  // Rule 2: Only one pending replacement per live offer.
  const existing = await prisma.offerReplacementRequest.findFirst({
    where: {
      currentOfferId: target.id,
      status: { in: PENDING_REPLACEMENT_STATUSES as any },
    },
    select: { id: true, status: true, newOfferId: true, currentOfferId: true },
  })

  if (existing) {
    throw new ReplacementValidationError(
      'PENDING_REPLACEMENT_EXISTS',
      'A replacement request already exists for this offer.',
    )
  }

  return { target }
}

/**
 * Best-effort check for whether an offer has a pending replacement
 * request. Used by GET endpoints to add a "replacement pending" flag
 * to the response without throwing.
 */
export async function findPendingReplacement(
  prisma: any,
  currentOfferId: string,
): Promise<ExistingRequestLite | null> {
  return prisma.offerReplacementRequest.findFirst({
    where: {
      currentOfferId,
      status: { in: PENDING_REPLACEMENT_STATUSES as any },
    },
    select: { id: true, status: true, newOfferId: true, currentOfferId: true },
  })
}

/**
 * Compute the effective merchant-visible status for a replacement
 * target. If a pending replacement exists, the new offer's effective
 * status is "REPLACEMENT_PENDING". Otherwise we return the underlying
 * status as-is.
 */
export function effectiveReplacementStatus(
  underlying: OfferStatus,
  hasPendingReplacement: boolean,
): OfferStatus | 'REPLACEMENT_PENDING' {
  if (hasPendingReplacement) return 'REPLACEMENT_PENDING'
  return underlying
}
