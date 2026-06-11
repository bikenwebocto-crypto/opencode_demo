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
    { success: false, error: { code: 'NOT_FOUND', message: 'Replacement request not found' } },
    { status: 404 },
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
    if (!user || user.userType !== 'admin') return unauthorized();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '10')));
    const status = searchParams.get('status'); // AWAITING_APPROVAL, APPROVED, REJECTED

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
              merchant: { select: { id: true, businessName: true, email: true } },
            },
          },
          newOffer: {
            select: {
              id: true, title: true, discountValue: true, offerType: true, status: true,
              imageUrls: true, termsAndConditions: true, description: true, shortDescription: true,
              startDate: true, endDate: true, submissionNotes: true,
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
    if (!user || user.userType !== 'admin') return unauthorized();

    const body = await request.json();
    const { id, action, adminNotes } = body;

    if (!id || !action) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Missing required fields: id, action' } },
        { status: 400 },
      );
    }

    const replacementReq = await prisma.offerReplacementRequest.findUnique({
      where: { id },
      include: { currentOffer: true, newOffer: true },
    });
    if (!replacementReq) return notFound();

    const adminUser = await prisma.adminUser.findUnique({ where: { email: user.email } });

    if (action === 'APPROVE') {
      // Archive current live offer, publish replacement
      await prisma.$transaction([
        prisma.merchantOffer.update({
          where: { id: replacementReq.currentOfferId },
          data: { status: 'ARCHIVED' },
        }),
        prisma.merchantOffer.update({
          where: { id: replacementReq.newOfferId },
          data: { status: 'LIVE', liveAt: new Date(), reviewedBy: adminUser?.id, reviewedAt: new Date() },
        }),
        prisma.offerReplacementRequest.update({
          where: { id },
          data: { status: 'APPROVED', adminId: adminUser?.id, adminNotes: adminNotes ?? null, reviewedAt: new Date() },
        }),
        // Close action queue items
        prisma.actionQueueItem.updateMany({
          where: {
            type: 'OFFER_REPLACEMENT',
            referenceId: replacementReq.currentOffer.merchantId,
            metadata: { path: ['newOfferId'], equals: replacementReq.newOfferId },
          },
          data: { status: 'COMPLETED', completedAt: new Date() },
        }),
      ]);

      return NextResponse.json({ success: true, message: 'Replacement approved. New offer is now live.' });
    }

    if (action === 'REJECT') {
      await prisma.$transaction([
        prisma.merchantOffer.update({
          where: { id: replacementReq.newOfferId },
          data: { status: 'REJECTED', rejectionReason: adminNotes ?? undefined, reviewedBy: adminUser?.id, reviewedAt: new Date() },
        }),
        prisma.offerReplacementRequest.update({
          where: { id },
          data: { status: 'REJECTED', adminId: adminUser?.id, adminNotes: adminNotes ?? null, reviewedAt: new Date() },
        }),
      ]);

      return NextResponse.json({ success: true, message: 'Replacement rejected. Current offer remains live.' });
    }

    if (action === 'CLARIFICATION') {
      await prisma.$transaction([
        prisma.merchantOffer.update({
          where: { id: replacementReq.newOfferId },
          data: { status: 'VALIDATION_FAILED', rejectionReason: adminNotes ?? undefined },
        }),
        prisma.offerReplacementRequest.update({
          where: { id },
          data: { status: 'CLARIFICATION_REQUESTED', adminId: adminUser?.id, adminNotes: adminNotes ?? null },
        }),
      ]);

      return NextResponse.json({ success: true, message: 'Clification requested from merchant.' });
    }

    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION', message: 'Invalid action. Use APPROVE, REJECT, or CLARIFICATION' } },
      { status: 400 },
    );
  } catch (error) {
    return internalError(error);
  }
}
