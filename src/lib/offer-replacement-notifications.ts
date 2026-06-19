/**
 * Notification helpers for the offer replacement workflow.
 *
 * Per spec:
 *   Merchant receives:
 *     - Replacement Submitted          (self-notified, for confirmation)
 *     - Replacement Approved
 *     - Replacement Rejected
 *     - Changes Requested
 *
 *   Admin receives:
 *     - New Replacement Waiting Review
 *
 * We use the existing NotificationEvent + queue worker pipeline
 * (the same one used by company activation / launch pack).
 */

import { prisma } from '@/lib/prisma'

export type ReplacementEvent =
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CHANGES_REQUESTED'
  | 'ADMIN_PENDING'

interface NotifyArgs {
  event: ReplacementEvent
  newOfferId: string
  currentOfferId: string
  merchantId: string
  reviewNotes?: string
  rejectionReason?: string
}

const MERCHANT_TITLES: Record<ReplacementEvent, string> = {
  SUBMITTED: 'Replacement offer submitted',
  APPROVED: 'Replacement offer approved',
  REJECTED: 'Replacement offer rejected',
  CHANGES_REQUESTED: 'Changes requested on your replacement offer',
  ADMIN_PENDING: '', // unused for merchant
}

const MERCHANT_BODIES: Record<ReplacementEvent, string> = {
  SUBMITTED:
    'Your replacement offer has been submitted for admin review. Your current live offer will stay visible until the replacement is approved.',
  APPROVED:
    'Your replacement offer has been approved and is now live. The previous offer has been archived.',
  REJECTED:
    'Your replacement offer was rejected. Your previous live offer remains active. See admin notes for details.',
  CHANGES_REQUESTED:
    'An admin has requested changes on your replacement offer. Edit the offer and resubmit when ready.',
  ADMIN_PENDING: '',
}

const ADMIN_TITLES: Record<ReplacementEvent, string> = {
  SUBMITTED: '',
  APPROVED: '',
  REJECTED: '',
  CHANGES_REQUESTED: '',
  ADMIN_PENDING: 'New offer replacement awaiting review',
}

const ADMIN_BODIES: Record<ReplacementEvent, string> = {
  SUBMITTED: '',
  APPROVED: '',
  REJECTED: '',
  CHANGES_REQUESTED: '',
  ADMIN_PENDING:
    'A merchant has submitted a replacement offer. Open the action queue to review.',
}

const PRIORITY: Record<ReplacementEvent, 'NORMAL' | 'HIGH' | 'URGENT'> = {
  SUBMITTED: 'NORMAL',
  APPROVED: 'NORMAL',
  REJECTED: 'NORMAL',
  CHANGES_REQUESTED: 'HIGH',
  ADMIN_PENDING: 'HIGH',
}

export async function notifyReplacement(args: NotifyArgs) {
  const event = args.event
  const channel = 'IN_APP'
  const now = new Date()

  if (event === 'ADMIN_PENDING') {
    // Fan out to all active admins
    const admins = await prisma.adminUser.findMany({
      where: { isActive: true },
      select: { id: true },
    })
    for (const admin of admins) {
      await prisma.notificationEvent.create({
        data: {
          recipientType: 'admin',
          adminId: admin.id,
          title: ADMIN_TITLES[event],
          body: ADMIN_BODIES[event],
          channel,
          priority: PRIORITY[event],
          referenceType: 'offer_replacement',
          referenceId: args.newOfferId,
          sentAt: now,
        },
      })
    }
    return
  }

  // Merchant notification
  await prisma.notificationEvent.create({
    data: {
      recipientType: 'merchant',
      merchantId: args.merchantId,
      title: MERCHANT_TITLES[event],
      body: MERCHANT_BODIES[event],
      channel,
      priority: PRIORITY[event],
      referenceType: 'offer_replacement',
      referenceId: args.newOfferId,
      sentAt: now,
    },
  })
}

/**
 * Audit log entry for a replacement event. Centralized so all four
 * actions write the same shape.
 */
export async function logReplacementAudit(args: {
  event:
    | 'OFFER_REPLACEMENT_CREATED'
    | 'OFFER_REPLACEMENT_APPROVED'
    | 'OFFER_REPLACEMENT_REJECTED'
    | 'OFFER_REPLACEMENT_CHANGES_REQUESTED'
  merchantId: string
  newOfferId: string
  currentOfferId: string
  adminId?: string | null
  reason?: string
  reviewNotes?: string
}) {
  await prisma.auditLog.create({
    data: {
      actorType: args.adminId ? 'admin' : 'merchant',
      adminId: args.adminId ?? null,
      merchantId: args.merchantId,
      action: args.event,
      entityType: 'merchant_offer',
      entityId: args.newOfferId,
      metadata: {
        currentOfferId: args.currentOfferId,
        newOfferId: args.newOfferId,
        reason: args.reason ?? null,
        reviewNotes: args.reviewNotes ?? null,
      } as any,
    },
  })
}
