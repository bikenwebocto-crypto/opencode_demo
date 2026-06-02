import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/supabase/server';

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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 },
      );
    }

    const { id } = await params;

    const merchant = await prisma.merchant.findUnique({ where: { id } });
    if (!merchant || merchant.deletedAt) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } },
        { status: 404 },
      );
    }

    await prisma.merchant.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: user.id },
    });

    await prisma.auditLog.create({
      data: {
        actorType: 'admin',
        adminId: user.id,
        action: 'MERCHANT_DELETED',
        entityType: 'merchant',
        entityId: id,
        changes: { businessName: merchant.businessName, email: merchant.email },
      },
    });

    return NextResponse.json({ success: true, data: null, message: 'Merchant deleted successfully' });
  } catch (error) {
    console.error('Merchant delete error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
