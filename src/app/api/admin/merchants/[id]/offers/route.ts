import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const merchant = await prisma.merchant.findUnique({ where: { id } });
    if (!merchant || merchant.deletedAt) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } },
        { status: 404 },
      );
    }

    const offers = await prisma.merchantOffer.findMany({
      where: { merchantId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { redemptions: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: offers,
      meta: { total: offers.length },
    });
  } catch (error) {
    console.error('Merchant offers error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
