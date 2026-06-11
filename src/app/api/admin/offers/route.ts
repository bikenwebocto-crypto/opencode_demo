import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 },
  );
}

function notFound() {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Offer not found' } },
    { status: 404 },
  );
}

function badRequest(message: string) {
  return NextResponse.json(
    { success: false, error: { code: 'VALIDATION', message } },
    { status: 400 },
  );
}

function internalError(error: unknown) {
  console.error('Admin offers error:', error);
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 },
  );
}

async function completeQueueItems(merchantId: string, offerId: string) {
  const items = await prisma.actionQueueItem.findMany({
    where: { referenceId: merchantId, type: 'OFFER_APPROVAL', status: 'PENDING' },
  });
  const matching = items.filter((i) => {
    const meta = i.metadata as Record<string, unknown> | null;
    return meta?.offerId === offerId;
  });
  for (const item of matching) {
    await prisma.actionQueueItem.update({
      where: { id: item.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== 'admin') return unauthorized();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'AWAITING_APPROVAL';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20')));
    const q = searchParams.get('q');

    const where: any = {};
    if (status !== 'ALL') where.status = status;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { merchant: { businessName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [offers, total] = await Promise.all([
      prisma.merchantOffer.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          merchant: { select: { id: true, businessName: true, email: true } },
          _count: { select: { redemptions: true } },
        },
      }),
      prisma.merchantOffer.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: offers,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page * pageSize < total,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    return internalError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== 'admin') return unauthorized();

    const body = await request.json();
    const { offerId, action, rejectionReason, adminNote } = body;

    if (!offerId || !action) return badRequest('offerId and action are required');
    if (!['APPROVE', 'REJECT', 'REQUEST_CHANGES'].includes(action)) return badRequest('Invalid action');

    const offer = await prisma.merchantOffer.findUnique({
      where: { id: offerId },
      include: { merchant: { select: { id: true, businessName: true } } },
    });

    if (!offer) return notFound();

    const reviewableStatuses = ['AWAITING_APPROVAL', 'CHANGES_REQUESTED'];
    if (action === 'APPROVE' && !['AWAITING_APPROVAL'].includes(offer.status)) {
      return badRequest('Only offers awaiting approval can be approved');
    }
    if (action === 'REJECT' && !reviewableStatuses.includes(offer.status)) {
      return badRequest('Offer is not in a reviewable state');
    }
    if (action === 'REQUEST_CHANGES' && !reviewableStatuses.includes(offer.status)) {
      return badRequest('Offer is not in a reviewable state');
    }

    const adminId = user.id;
    const now = new Date();

    if (action === 'APPROVE') {
      await prisma.merchantOffer.update({
        where: { id: offerId },
        data: {
          status: 'LIVE',
          liveAt: now,
          reviewedAt: now,
          reviewedBy: adminId,
        },
      });

      await completeQueueItems(offer.merchantId, offerId);

      await prisma.notificationEvent.create({
        data: {
          recipientType: 'MERCHANT',
          merchantId: offer.merchantId,
          title: 'Offer Approved',
          body: `Your offer "${offer.title}" has been approved and is now live.`,
          channel: 'IN_APP',
          referenceType: 'MERCHANT_OFFER',
          referenceId: offerId,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorType: 'admin',
          adminId,
          action: 'OFFER_APPROVED',
          entityType: 'MERCHANT_OFFER',
          entityId: offerId,
          changes: { from: offer.status, to: 'LIVE' },
        },
      });
    }

    if (action === 'REJECT') {
      if (!rejectionReason) return badRequest('Rejection reason is required');

      await prisma.merchantOffer.update({
        where: { id: offerId },
        data: {
          status: 'REJECTED',
          rejectionReason,
          reviewedAt: now,
          reviewedBy: adminId,
        },
      });

      await completeQueueItems(offer.merchantId, offerId);

      await prisma.notificationEvent.create({
        data: {
          recipientType: 'MERCHANT',
          merchantId: offer.merchantId,
          title: 'Offer Rejected',
          body: `Your offer "${offer.title}" has been rejected. Reason: ${rejectionReason}`,
          channel: 'IN_APP',
          referenceType: 'MERCHANT_OFFER',
          referenceId: offerId,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorType: 'admin',
          adminId,
          action: 'OFFER_REJECTED',
          entityType: 'MERCHANT_OFFER',
          entityId: offerId,
          changes: { from: offer.status, to: 'REJECTED', reason: rejectionReason },
        },
      });
    }

    if (action === 'REQUEST_CHANGES') {
      await prisma.merchantOffer.update({
        where: { id: offerId },
        data: {
          status: 'CHANGES_REQUESTED',
          adminNote: adminNote ?? null,
          reviewedAt: now,
          reviewedBy: adminId,
        },
      });

      await completeQueueItems(offer.merchantId, offerId);

      await prisma.notificationEvent.create({
        data: {
          recipientType: 'MERCHANT',
          merchantId: offer.merchantId,
          title: 'Offer Changes Requested',
          body: `Changes requested for "${offer.title}".${adminNote ? ` Note: ${adminNote}` : ''}`,
          channel: 'IN_APP',
          referenceType: 'MERCHANT_OFFER',
          referenceId: offerId,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorType: 'admin',
          adminId,
          action: 'OFFER_CHANGES_REQUESTED',
          entityType: 'MERCHANT_OFFER',
          entityId: offerId,
          changes: { from: offer.status, to: 'CHANGES_REQUESTED', adminNote },
        },
      });
    }

    return NextResponse.json({ success: true, data: { id: offerId, action } });
  } catch (error) {
    return internalError(error);
  }
}
