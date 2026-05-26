import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/supabase/server';
import { adminApproveMerchantSchema } from '@/schemas';

// GET /api/admin/merchants
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') ?? '1');
    const pageSize = parseInt(searchParams.get('pageSize') ?? '20');
    const search = searchParams.get('q');

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [merchants, total] = await Promise.all([
      prisma.merchant.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: true,
          _count: { select: { offers: true, branches: true, redemptions: true } },
        },
      }),
      prisma.merchant.count({ where: where as any }),
    ]);

    return NextResponse.json({
      success: true,
      data: merchants,
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
    console.error('Merchant list error:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'Internal server error' } }, { status: 500 });
  }
}

// POST /api/admin/merchants/approve
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }

    const formData = await request.formData();
    const raw = {
      merchantId: formData.get('merchantId') as string,
      status: formData.get('status') as string,
      rejectionReason: formData.get('rejectionReason') as string | undefined,
    };

    const parsed = adminApproveMerchantSchema.parse(raw);

    const merchant = await prisma.merchant.update({
      where: { id: parsed.merchantId },
      data: {
        status: parsed.status as any,
        rejectionReason: parsed.rejectionReason,
        approvedAt: parsed.status === 'ACTIVE' ? new Date() : undefined,
      },
    });

    await prisma.merchantStatusHistory.create({
      data: {
        merchantId: parsed.merchantId,
        toStatus: parsed.status as any,
        changedBy: user.id,
        changedByType: 'admin',
        reason: parsed.rejectionReason,
      },
    });

    // Complete pending action queue items
    await prisma.actionQueueItem.updateMany({
      where: { referenceId: parsed.merchantId, referenceType: 'merchant', status: 'PENDING' },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    return NextResponse.json({ success: true, data: merchant });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'Validation failed', details: error.errors } }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'Internal server error' } }, { status: 500 });
  }
}
