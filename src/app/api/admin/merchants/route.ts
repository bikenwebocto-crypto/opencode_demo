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
    console.log('========== MERCHANT APPROVAL START ==========');

    const user = await getCurrentUser();
    console.log('1. Current user:', JSON.stringify(user, null, 2));

    if (!user) {
      console.log('2. User not found');
      return unauthorized();
    }

    // Verify admin exists
    const adminRecord = await prisma.adminUser.findUnique({
      where: { id: user.id },
    });

    console.log('3. Admin record lookup:', adminRecord);

    const body = await request.json();
    console.log('4. Request body:', body);

    const parsed = adminApproveMerchantSchema.safeParse(body);

    if (!parsed.success) {
      console.log('5. Validation failed:', parsed.error.flatten());
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION',
            message: 'Validation failed',
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    console.log('5. Validation passed');

    const { merchantId, status, rejectionReason, notes, adminNote } = parsed.data;

    console.log('6. Looking up merchant:', merchantId);

    const existing = await prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    console.log('7. Existing merchant:', existing);

    if (!existing || existing.deletedAt) {
      console.log('8. Merchant not found');
      return notFound('Merchant');
    }

    const previousStatus = existing.status;

    console.log('9. Updating merchant');

    const merchant = await prisma.merchant.update({
      where: { id: merchantId },
      data: {
        status: status as any,
        rejectionReason,
        adminNote: adminNote ?? existing.adminNote,
        notes: notes ?? existing.notes,
        approvedAt: status === 'ACTIVE' ? new Date() : undefined,
        liveAt:
          status === 'ACTIVE' && !existing.liveAt
            ? new Date()
            : undefined,
        onboardingStep:
          status === 'ACTIVE'
            ? 'COMPLETE'
            : existing.onboardingStep,
      },
    });

    console.log('10. Merchant updated:', merchant.id);

    console.log('11. Creating status history');

    const history = await prisma.merchantStatusHistory.create({
      data: {
        merchantId,
        fromStatus: previousStatus,
        toStatus: status as any,
        changedBy: user.id,
        changedByType: 'admin',
        reason: rejectionReason,
      },
    });

    console.log('12. Status history created:', history.id);

    console.log('13. Creating audit log');
    console.log('13a. adminId:', user.id);

    const auditLog = await prisma.auditLog.create({
      data: {
        actorType: 'admin',
        adminId: user.id,
        action: `MERCHANT_${status}`,
        entityType: 'merchant',
        entityId: merchantId,
        changes: {
          from: previousStatus,
          to: status,
          rejectionReason,
        },
      },
    });

    console.log('14. Audit log created:', auditLog.id);

    console.log('15. Updating action queue');

    const queueResult = await prisma.actionQueueItem.updateMany({
      where: {
        referenceId: merchantId,
        referenceType: 'merchant',
        status: 'PENDING',
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    console.log('16. Queue updated:', queueResult);

    console.log('========== MERCHANT APPROVAL SUCCESS ==========');

    return NextResponse.json({
      success: true,
      data: merchant,
      message: `Merchant ${status.toLowerCase()} successfully`,
    });
  } catch (error: any) {
    console.error('========== ERROR ==========');
    console.error(error);

    if (error.code === 'P2003') {
      console.error('Foreign Key Violation');
      console.error('Meta:', error.meta);
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
