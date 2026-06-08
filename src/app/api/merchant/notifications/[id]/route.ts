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
    { success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } },
    { status: 404 },
  );
}

function internalError(error: unknown) {
  console.error('Merchant notification error:', error);
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 },
  );
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== 'merchant') return unauthorized();

    const merchant = await prisma.merchant.findUnique({ where: { email: user.email } });
    if (!merchant) return unauthorized();

    const { id } = await params;

    const notification = await prisma.notificationEvent.findFirst({
      where: { id, merchantId: merchant.id },
    });
    if (!notification) return notFound();

    await prisma.notificationEvent.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError(error);
  }
}
