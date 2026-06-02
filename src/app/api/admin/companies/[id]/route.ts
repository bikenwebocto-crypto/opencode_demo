import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    console.log('Company detail request by user:', user?.id, user?.email, user?.userType, user?.role);
    // if (!user || user.userType !== 'admin') {
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 },
      );
    }

    const { id } = await params;

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        billing: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { company: { select: { name: true } } },
        },
        _count: { select: { employees: true, redemptions: true, csvUploads: true } },
      },
    });

    if (!company || company.deletedAt) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: company });
  } catch (error) {
    console.error('Company detail error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
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
    const body = await request.json();

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company || company.deletedAt) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } },
        { status: 404 },
      );
    }

    if (body.status) {
      const previousStatus = company.status;
      const validStatuses = ['PENDING', 'ACTIVE', 'PAUSED', 'SUSPENDED', 'CANCELLED', 'APPROVED_PENDING_PAYMENT'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION', message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` } },
          { status: 400 },
        );
      }

      await prisma.company.update({
        where: { id },
        data: {
          status: body.status,
          adminNote: body.adminNote ?? company.adminNote,
          approvedAt: body.status === 'ACTIVE' && !company.approvedAt ? new Date() : undefined,
        },
      });

      await prisma.companyStatusHistory.create({
        data: {
          companyId: id,
          fromStatus: previousStatus,
          toStatus: body.status,
          changedBy: user.id,
          changedByType: 'admin',
          reason: body.reason,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorType: 'admin',
          adminId: user.id,
          action: `COMPANY_${body.status}`,
          entityType: 'company',
          entityId: id,
          changes: { from: previousStatus, to: body.status, reason: body.reason },
        },
      });
    }

    if (body.adminNote !== undefined) {
      await prisma.company.update({
        where: { id },
        data: { adminNote: body.adminNote.substring(0, 500) },
      });
    }

    if (body.billingStatus) {
      const validBillingStatuses = ['ACTIVE', 'INVOICE_OVERDUE', 'ON_HOLD'];
      if (!validBillingStatuses.includes(body.billingStatus)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION', message: `Invalid billing status. Must be one of: ${validBillingStatuses.join(', ')}` } },
          { status: 400 },
        );
      }

      await prisma.companyBilling.update({
        where: { companyId: id },
        data: { billingStatus: body.billingStatus as any },
      });
    }

    const updated = await prisma.company.findUnique({
      where: { id },
      include: {
        billing: true,
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 10 },
        _count: { select: { employees: true, redemptions: true, csvUploads: true } },
      },
    });

    return NextResponse.json({ success: true, data: updated, message: 'Company updated successfully' });
  } catch (error) {
    console.error('Company update error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
