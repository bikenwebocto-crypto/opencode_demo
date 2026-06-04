import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/supabase/server';

const EDITABLE_STATUSES = ['DRAFT', 'VALIDATION_FAILED'];

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 },
  );
}

function notFound(msg = 'Offer not found') {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: msg } },
    { status: 404 },
  );
}

function forbidden(msg: string) {
  return NextResponse.json(
    { success: false, error: { code: 'FORBIDDEN', message: msg } },
    { status: 403 },
  );
}

function internalError(error: unknown) {
  console.error('Merchant offer error:', error);
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 },
  );
}

async function getMerchantFromUser() {
  const user = await getCurrentUser();
  if (!user || user.userType !== 'merchant') return null;
  return prisma.merchant.findUnique({ where: { email: user.email } });
}

async function getOwnOffer(merchantId: string, offerId: string) {
  return prisma.merchantOffer.findFirst({
    where: { id: offerId, merchantId },
    include: { _count: { select: { redemptions: true } } },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const merchant = await getMerchantFromUser();
    if (!merchant) return unauthorized();
    const { id } = await params;
    const offer = await getOwnOffer(merchant.id, id);
    if (!offer) return notFound();
    return NextResponse.json({ success: true, data: offer });
  } catch (error) {
    return internalError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const merchant = await getMerchantFromUser();
    if (!merchant) return unauthorized();
    const { id } = await params;
    const existing = await getOwnOffer(merchant.id, id);
    if (!existing) return notFound();

    if (!EDITABLE_STATUSES.includes(existing.status)) {
      return forbidden('Only draft or validation-failed offers can be edited');
    }

    const body = await request.json();
    const updatable: any = {};
    const fields = [
      'title', 'description', 'shortDescription', 'termsAndConditions',
      'imageUrls', 'offerType', 'discountValue', 'discountMax', 'discountPercent',
      'minimumSpend', 'maxRedemptions', 'daysOfWeek',
      'redemptionCode', 'redemptionInstructions', 'categoryId', 'submissionNotes',
    ];
    for (const f of fields) {
      if (body[f] !== undefined) updatable[f] = body[f];
    }
    if (body.startDate) updatable.startDate = new Date(body.startDate);
    if (body.endDate) updatable.endDate = new Date(body.endDate);

    const offer = await prisma.merchantOffer.update({
      where: { id },
      data: updatable,
    });

    return NextResponse.json({ success: true, data: offer });
  } catch (error) {
    return internalError(error);
  }
}
