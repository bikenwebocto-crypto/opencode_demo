import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/supabase/server';
import { adminApproveMerchantSchema } from '@/schemas';

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 },
  );
}

function notFound(entity: string) {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: `${entity} not found` } },
    { status: 404 },
  );
}

function internalError(error: unknown) {
  console.error('Merchants API error:', error);
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 },
  );
}

// GET /api/admin/merchants — list merchants
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    console.log('Current user:', user);
    // if (!user || user.userType !== 'admin') return unauthorized();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const categoryId = searchParams.get('categoryId');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20')));
    const q = searchParams.get('q');
    

    const where: Record<string, unknown> = { deletedAt: null };
    if (status && status !== 'ALL') where.status = status;
    if (categoryId && categoryId !== 'ALL') where.categoryId = categoryId;
    if (q) {
      where.OR = [
        { businessName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { contactName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [merchants, total] = await Promise.all([
      prisma.merchant.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          _count: { select: { offers: true, branches: true, redemptions: true, issues: true } },
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
    return internalError(error);
  }
}

// POST /api/admin/merchants — approve/reject merchant
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== 'admin') return unauthorized();

    const body = await request.json();
    const parsed = adminApproveMerchantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Validation failed', details: parsed.error.flatten().fieldErrors } },
        { status: 400 },
      );
    }

    const { merchantId, status, rejectionReason, notes } = parsed.data;

    const existing = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!existing || existing.deletedAt) return notFound('Merchant');

    const previousStatus = existing.status;

    const merchant = await prisma.merchant.update({
      where: { id: merchantId },
      data: {
        status: status as any,
        rejectionReason,
        notes: notes ?? existing.notes,
        approvedAt: status === 'ACTIVE' ? new Date() : undefined,
        onboardingStep: status === 'ACTIVE' ? 'COMPLETE' : existing.onboardingStep,
      },
    });

    await prisma.merchantStatusHistory.create({
      data: {
        merchantId,
        fromStatus: previousStatus,
        toStatus: status as any,
        changedBy: user.id,
        changedByType: 'admin',
        reason: rejectionReason,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorType: 'admin',
        adminId: user.id,
        action: `MERCHANT_${status}`,
        entityType: 'merchant',
        entityId: merchantId,
        changes: { from: previousStatus, to: status, rejectionReason },
      },
    });

    // Complete pending action queue items
    await prisma.actionQueueItem.updateMany({
      where: { referenceId: merchantId, referenceType: 'merchant', status: 'PENDING' },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    return NextResponse.json({ success: true, data: merchant, message: `Merchant ${status.toLowerCase()} successfully` });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Validation failed', details: error.errors } },
        { status: 400 },
      );
    }
    return internalError(error);
  }
}

// PATCH /api/admin/merchants — update merchant details
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== 'admin') return unauthorized();

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Merchant ID is required' } },
        { status: 400 },
      );
    }

    const existing = await prisma.merchant.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) return notFound('Merchant');

    const merchant = await prisma.merchant.update({
      where: { id },
      data: updates,
    });

    await prisma.auditLog.create({
      data: {
        actorType: 'admin',
        adminId: user.id,
        action: 'MERCHANT_UPDATED',
        entityType: 'merchant',
        entityId: id,
        changes: updates,
      },
    });

    return NextResponse.json({ success: true, data: merchant, message: 'Merchant updated successfully' });
  } catch (error) {
    return internalError(error);
  }
}

// DELETE /api/admin/merchants — soft-delete a merchant
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== 'admin') return unauthorized();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Merchant ID is required' } },
        { status: 400 },
      );
    }

    const existing = await prisma.merchant.findUnique({ where: { id } });
    if (!existing) return notFound('Merchant');

    await prisma.merchant.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });

    await prisma.auditLog.create({
      data: {
        actorType: 'admin',
        adminId: user.id,
        action: 'MERCHANT_DELETED',
        entityType: 'merchant',
        entityId: id,
        changes: {},
      },
    });

    return NextResponse.json({ success: true, data: null, message: 'Merchant deleted successfully' });
  } catch (error) {
    return internalError(error);
  }
}
