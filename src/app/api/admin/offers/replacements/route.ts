import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/supabase/server';
import { forbidden } from '@/lib/api-auth';
import {
  logReplacementAudit,
  notifyReplacement,
} from '@/lib/offer-replacement-notifications';

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 },
  );
}

function notFound() {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Replacement request not found' } },
    { status: 404 },
  );
}

function badRequest(message: string) {
  return NextResponse.json(
    { success: false, error: { code: 'VALIDATION', message } },
    { status: 400 },
  );
}

function conflict(message: string) {
  return NextResponse.json(
    { success: false, error: { code: 'CONFLICT', message } },
    { status: 409 },
  );
}

function internalError(error: unknown) {
  console.error('Admin replacements error:', error);
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 },
  );
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (user.userType !== 'admin') return forbidden(user.userType);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '10')));
    const status = searchParams.get('status'); // AWAITING_APPROVAL, APPROVED, REJECTED, CLARIFICATION_REQUESTED

    const where: any = {};
    if (status) where.status = status;

    const [requests, total] = await Promise.all([
      prisma.offerReplacementRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          currentOffer: {
            select: {
              id: true, title: true, discountValue: true, offerType: true, status: true,
              imageUrls: true, termsAndConditions: true, description: true, startDate: true, endDate: true,
              discountPercent: true, discountMax: true, minimumSpend: true, maxRedemptions: true,
              redemptionCode: true, redemptionInstructions: true, categoryId: true,
              merchant: { select: { id: true, businessName: true, email: true } },
            },
          },
          newOffer: {
            select: {
              id: true, title: true, discountValue: true, offerType: true, status: true,
              imageUrls: true, termsAndConditions: true, description: true, shortDescription: true,
              startDate: true, endDate: true, submissionNotes: true, replacementReason: true,
              discountPercent: true, discountMax: true, minimumSpend: true, maxRedemptions: true,
              redemptionCode: true, redemptionInstructions: true, categoryId: true,
              reviewNotes: true, rejectionReason: true,
            },
          },
          admin: { select: { id: true, email: true } },
        },
      }),
      prisma.offerReplacementRequest.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: requests,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return internalError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (user.userType !== 'admin') return forbidden(user.userType);

    const body = await request.json();
    const { id, action, adminNotes, reason } = body;

    if (!id || !action) {
      return badRequest('Missing required fields: id, action');
    }

    const replacementReq = await prisma.offerReplacementRequest.findUnique({
      where: { id },
      include: {
        currentOffer: true,
        newOffer: true,
      },
    });
    if (!replacementReq) return notFound();

    // Idempotency: cannot re-finalize a terminal request.
    if (['APPROVED', 'REJECTED'].includes(replacementReq.status)) {
      return conflict(`This replacement has already been ${replacementReq.status.toLowerCase()}.`)
    }

    const adminUser = await prisma.adminUser.findUnique({ where: { email: user.email } });
    const adminId = adminUser?.id ?? null;
    const merchantId = replacementReq.currentOffer.merchantId;
    const notes = (adminNotes ?? reason ?? '').toString().trim()

    if (action === 'APPROVE') {
      // Rule 4: ensure the merchant will end up with exactly one LIVE offer.
      // In normal flow, the current offer is ARCHIVED and the new one goes
      // LIVE. We also archive any other LIVE offers for this merchant
      // (defensive — should never happen under the one-LIVE invariant).
      const otherLiveCount = await prisma.merchantOffer.count({
        where: {
          merchantId,
          status: 'LIVE',
          id: { not: replacementReq.newOfferId },
        },
      })
      if (otherLiveCount > 1) {
        return conflict(
          'Multiple live offers detected for this merchant. Resolve manually before approving.',
        )
      }

      const now = new Date()
      await prisma.$transaction([
        prisma.merchantOffer.update({
          where: { id: replacementReq.currentOfferId },
          data: { status: 'ARCHIVED' },
        }),
        prisma.merchantOffer.update({
          where: { id: replacementReq.newOfferId },
          data: {
            status: 'LIVE',
            liveAt: now,
            reviewedBy: adminId,
            reviewedAt: now,
            reviewNotes: null,
            rejectionReason: null,
          },
        }),
        prisma.offerReplacementRequest.update({
          where: { id },
          data: {
            status: 'APPROVED',
            adminId,
            adminNotes: notes || null,
            reviewedAt: now,
          },
        }),
        prisma.actionQueueItem.updateMany({
          where: {
            type: 'OFFER_REPLACEMENT',
            referenceId: merchantId,
            metadata: { path: ['newOfferId'], equals: replacementReq.newOfferId },
          },
          data: { status: 'COMPLETED', completedAt: now },
        }),
      ])

      await logReplacementAudit({
        event: 'OFFER_REPLACEMENT_APPROVED',
        merchantId,
        newOfferId: replacementReq.newOfferId,
        currentOfferId: replacementReq.currentOfferId,
        adminId,
        reason: notes || null,
      })

      await notifyReplacement({
        event: 'APPROVED',
        merchantId,
        newOfferId: replacementReq.newOfferId,
        currentOfferId: replacementReq.currentOfferId,
      }).catch((err) => console.error('Replacement approved notify failed', err))

      return NextResponse.json({
        success: true,
        message: 'Replacement approved. New offer is now live.',
      })
    }

    if (action === 'REJECT') {
      if (!notes) return badRequest('Rejection reason is required (adminNotes or reason).')

      const now = new Date()
      await prisma.$transaction([
        prisma.merchantOffer.update({
          where: { id: replacementReq.newOfferId },
          data: {
            status: 'REJECTED',
            rejectionReason: notes,
            reviewedBy: adminId,
            reviewedAt: now,
          },
        }),
        prisma.offerReplacementRequest.update({
          where: { id },
          data: {
            status: 'REJECTED',
            adminId,
            adminNotes: notes,
            reviewedAt: now,
          },
        }),
        prisma.actionQueueItem.updateMany({
          where: {
            type: 'OFFER_REPLACEMENT',
            referenceId: merchantId,
            metadata: { path: ['newOfferId'], equals: replacementReq.newOfferId },
          },
          data: { status: 'FAILED', completedAt: now },
        }),
      ])

      await logReplacementAudit({
        event: 'OFFER_REPLACEMENT_REJECTED',
        merchantId,
        newOfferId: replacementReq.newOfferId,
        currentOfferId: replacementReq.currentOfferId,
        adminId,
        reason: notes,
      })

      await notifyReplacement({
        event: 'REJECTED',
        merchantId,
        newOfferId: replacementReq.newOfferId,
        currentOfferId: replacementReq.currentOfferId,
        rejectionReason: notes,
      }).catch((err) => console.error('Replacement rejected notify failed', err))

      return NextResponse.json({
        success: true,
        message: 'Replacement rejected. Current offer remains live.',
      })
    }

    if (action === 'REQUEST_CHANGES' || action === 'CLARIFICATION') {
      if (!notes) return badRequest('Review notes are required when requesting changes.')

      const now = new Date()
      await prisma.$transaction([
        prisma.merchantOffer.update({
          where: { id: replacementReq.newOfferId },
          data: {
            status: 'CHANGES_REQUESTED',
            reviewNotes: notes,
            reviewedBy: adminId,
            reviewedAt: now,
          },
        }),
        prisma.offerReplacementRequest.update({
          where: { id },
          data: {
            status: 'CLARIFICATION_REQUESTED',
            adminId,
            adminNotes: notes,
          },
        }),
        prisma.actionQueueItem.updateMany({
          where: {
            type: 'OFFER_REPLACEMENT',
            referenceId: merchantId,
            metadata: { path: ['newOfferId'], equals: replacementReq.newOfferId },
          },
          data: {
            status: 'IN_PROGRESS',
            metadata: { path: ['newOfferId'], equals: replacementReq.newOfferId },
          },
        }),
      ])

      await logReplacementAudit({
        event: 'OFFER_REPLACEMENT_CHANGES_REQUESTED',
        merchantId,
        newOfferId: replacementReq.newOfferId,
        currentOfferId: replacementReq.currentOfferId,
        adminId,
        reviewNotes: notes,
      })

      await notifyReplacement({
        event: 'CHANGES_REQUESTED',
        merchantId,
        newOfferId: replacementReq.newOfferId,
        currentOfferId: replacementReq.currentOfferId,
        reviewNotes: notes,
      }).catch((err) => console.error('Replacement changes-requested notify failed', err))

      return NextResponse.json({
        success: true,
        message: 'Changes requested. Merchant can edit and resubmit.',
      })
    }

    return badRequest('Invalid action. Use APPROVE, REJECT, or REQUEST_CHANGES.')
  } catch (error) {
    return internalError(error);
  }
}
