import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const merchant = await prisma.merchant.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { offers: true, branches: true, redemptions: true, issues: true } },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!merchant || merchant.deletedAt) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: merchant });
  } catch (error) {
    console.error('Merchant detail error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
