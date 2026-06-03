import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/supabase/server';

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 },
  );
}

function internalError(error: unknown) {
  console.error('Merchant offers error:', error);
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

export async function GET(request: NextRequest) {
  try {
    const merchant = await getMerchantFromUser();
    if (!merchant) return unauthorized();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '10')));
    const status = searchParams.get('status');
    const q = searchParams.get('q');

    const where: any = { merchantId: merchant.id };
    if (status) where.status = status;
    if (q) where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];

    const [offers, total] = await Promise.all([
      prisma.merchantOffer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { redemptions: true } } },
      }),
      prisma.merchantOffer.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: offers,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return internalError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const merchant = await getMerchantFromUser();
    // if (!merchant) return unauthorized();

    const body = await request.json();
    const {
      title, description, shortDescription, termsAndConditions,
      imageUrls, offerType, discountValue, discountMax, discountPercent,
      minimumSpend, maxRedemptions, startDate, endDate,
      daysOfWeek, redemptionCode, redemptionInstructions,
    } = body;

    if (!title || !offerType || discountValue == null || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Missing required fields: title, offerType, discountValue, startDate, endDate' } },
        { status: 400 },
      );
    }

    const offer = await prisma.merchantOffer.create({
      data: {
        merchantId: merchant.id,
        title,
        description: description ?? '',
        shortDescription: shortDescription ?? null,
        termsAndConditions: termsAndConditions ?? null,
        imageUrls: imageUrls ?? [],
        offerType,
        discountValue,
        discountMax: discountMax ?? null,
        discountPercent: discountPercent ?? null,
        minimumSpend: minimumSpend ?? null,
        maxRedemptions: maxRedemptions ?? null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        daysOfWeek: daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6],
        redemptionCode: redemptionCode ?? null,
        redemptionInstructions: redemptionInstructions ?? null,
        status: 'DRAFT',
      },
    });

    return NextResponse.json({ success: true, data: offer }, { status: 201 });
  } catch (error) {
    return internalError(error);
  }
}
