import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/supabase/server';

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

    if (existing.status !== 'DRAFT' && existing.status !== 'PENDING_APPROVAL') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only draft or pending approval offers can be edited' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const updatable: any = {};
    const fields = [
      'title', 'description', 'shortDescription', 'termsAndConditions',
      'imageUrls', 'offerType', 'discountValue', 'discountMax', 'discountPercent',
      'minimumSpend', 'maxRedemptions', 'daysOfWeek',
      'redemptionCode', 'redemptionInstructions',
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const merchant = await getMerchantFromUser();
    if (!merchant) return unauthorized();
    const { id } = await params;
    const existing = await getOwnOffer(merchant.id, id);
    if (!existing) return notFound();

    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only draft offers can be deleted' } },
        { status: 403 },
      );
    }

    await prisma.merchantOffer.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Offer deleted successfully' });
  } catch (error) {
    return internalError(error);
  }
}
