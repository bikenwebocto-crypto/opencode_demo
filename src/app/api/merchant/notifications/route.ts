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
  console.error('Merchant notifications error:', error);
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 },
  );
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== 'merchant') return unauthorized();

    const account = await prisma.account.findUnique({ where: { email: user.email }, select: { authUserId: true } });
    if (!account) return unauthorized();
    const merchant = await prisma.merchant.findFirst({ where: { accountId: account.authUserId } });
    if (!merchant) return unauthorized();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20')));
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const where: any = { merchantId: merchant.id };
    if (unreadOnly) where.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notificationEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notificationEvent.count({ where }),
      prisma.notificationEvent.count({ where: { merchantId: merchant.id, isRead: false } }),
    ]);

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount,
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

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== 'merchant') return unauthorized();

    const account = await prisma.account.findUnique({ where: { email: user.email }, select: { authUserId: true } });
    if (!account) return unauthorized();
    const merchant = await prisma.merchant.findFirst({ where: { accountId: account.authUserId } });
    if (!merchant) return unauthorized();

    await prisma.notificationEvent.updateMany({
      where: { merchantId: merchant.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError(error);
  }
}
