import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { adminCompanyActionSchema } from '@/schemas';
import * as bcrypt from 'bcryptjs';
import { validateUserEmail } from '@/services/user-validation.service';

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
  console.error('Companies API error:', error);
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 },
  );
}

// GET /api/admin/companies — list all companies
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    // if (!user || user.userType !== 'admin') return unauthorized();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20')));
    const q = searchParams.get('q');

    const where: Record<string, unknown> = { deletedAt: null };
    if (status && status !== 'ALL') where.status = status;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { employees: true, redemptions: true, csvUploads: true } },
          billing: { select: { plan: true, isTrial: true, trialEndsAt: true, billingStatus: true, renewalDate: true } },
        },
      }),
      prisma.company.count({ where: where as any }),
    ]);

    return NextResponse.json({
      success: true,
      data: companies,
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

// POST /api/admin/companies — create a new company
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== 'admin') return unauthorized();

    const body = await request.json();
    const { name, email, password, firstName, lastName, phone, website, employeeCount, addressLine1, addressLine2, city, state, postalCode, country, taxId } = body;

    if (!name || !email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Missing required fields: name, email, password, firstName, lastName' } },
        { status: 400 },
      );
    }

    const validation = await validateUserEmail(email);
    if (validation.exists) {
      return NextResponse.json(
        { success: false, error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Email is already assigned to another account' } },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name,
          slug,
          email,
          employeeCount: employeeCount ?? 0,
          phone,
          website,
          addressLine1,
          addressLine2,
          city,
          state,
          postalCode,
          country,
          taxId,
          status: 'ACTIVE',
          approvedAt: new Date(),
        },
      });

      const companyAdmin = await tx.companyAdmin.create({
        data: {
          companyId: company.id,
          email,
          passwordHash,
          firstName,
          lastName,
          isPrimary: true,
          isActive: true,
        },
      });

      await tx.account.create({
        data: {
          authUserId: companyAdmin.id,
          email,
          role: 'COMPANY_ADMIN',
          profileId: companyAdmin.id,
          profileType: 'COMPANY_ADMIN',
          status: 'ACTIVE',
        },
      });

      await tx.companyBilling.create({
        data: {
          companyId: company.id,
          plan: 'growth',
          pricePerEmployee: 5.0,
          isTrial: true,
          trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      await tx.auditLog.create({
        data: {
          actorType: 'admin',
          adminId: user.id,
          action: 'COMPANY_CREATED',
          entityType: 'company',
          entityId: company.id,
          changes: {},
        },
      });

      return company;
    });

    return NextResponse.json(
      { success: true, data: result, message: 'Company created successfully' },
      { status: 201 },
    );
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'A company with this email or slug already exists' } },
        { status: 409 },
      );
    }
    return internalError(error);
  }
}

// PATCH /api/admin/companies — update company status
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== 'admin') return unauthorized();

    const body = await request.json();
    const parsed = adminCompanyActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Validation failed', details: parsed.error.flatten().fieldErrors } },
        { status: 400 },
      );
    }

    const { companyId, status, reason, adminNote } = parsed.data;

    const existing = await prisma.company.findUnique({ where: { id: companyId } });
    if (!existing || existing.deletedAt) return notFound('Company');

    const previousStatus = existing.status;

    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        status: status as any,
        adminNote: adminNote ?? existing.adminNote,
        approvedAt: status === 'ACTIVE' && !existing.approvedAt ? new Date() : undefined,
      },
    });

    await prisma.companyStatusHistory.create({
      data: {
        companyId,
        fromStatus: previousStatus,
        toStatus: status as any,
        changedBy: user.id,
        changedByType: 'admin',
        reason,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorType: 'admin',
        adminId: user.id,
        action: `COMPANY_${status}`,
        entityType: 'company',
        entityId: companyId,
        changes: { from: previousStatus, to: status, reason },
      },
    });

    // Complete pending action queue items
    if (status === 'ACTIVE' || status === 'CANCELLED') {
      await prisma.actionQueueItem.updateMany({
        where: { referenceId: companyId, referenceType: 'company', status: 'PENDING' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    }

    return NextResponse.json({ success: true, data: company, message: `Company ${status.toLowerCase()} successfully` });
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

// DELETE /api/admin/companies — soft-delete a company
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== 'admin') return unauthorized();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Company ID is required' } },
        { status: 400 },
      );
    }

    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) return notFound('Company');

    await prisma.company.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: user.id, status: 'CANCELLED' },
    });

    // Cascade soft-delete all employees of this company
    await prisma.employee.updateMany({
      where: { companyId: id, deletedAt: null },
      data: { deletedAt: new Date(), deletedById: user.id, status: 'INACTIVE' },
    });

    await prisma.auditLog.create({
      data: {
        actorType: 'admin',
        adminId: user.id,
        action: 'COMPANY_DELETED',
        entityType: 'company',
        entityId: id,
        changes: { name: existing.name, email: existing.email },
      },
    });

    return NextResponse.json({ success: true, data: null, message: 'Company and its employees deleted successfully' });
  } catch (error) {
    return internalError(error);
  }
}
