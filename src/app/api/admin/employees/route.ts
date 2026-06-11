import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { adminEmployeeActionSchema } from '@/schemas';
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
  console.error('Employees API error:', error);
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 },
  );
}

// GET /api/admin/employees — list employees with filters
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    console.log('Employee Current user:', user);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const companyId = searchParams.get('companyId');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20')));
    const q = searchParams.get('q');

    const where: Record<string, unknown> = { deletedAt: null };
    if (status && status !== 'ALL') where.status = status;
    if (companyId && companyId !== 'ALL') where.companyId = companyId;
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          company: { select: { id: true, name: true, slug: true } },
          _count: { select: { redemptions: true } },
        },
      }),
      prisma.employee.count({ where: where as any }),
    ]);

    return NextResponse.json({
      success: true,
      data: employees,
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

// POST /api/admin/employees — create a single employee
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== 'admin') return unauthorized();

    const body = await request.json();
    const { email, firstName, lastName, companyId, department, jobTitle, employeeId, phone, joinMethod } = body;

    if (!email || !firstName || !lastName || !companyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Missing required fields: email, firstName, lastName, companyId' } },
        { status: 400 },
      );
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company || company.deletedAt) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } },
        { status: 404 },
      );
    }

    const validation = await validateUserEmail(email);
    if (validation.exists) {
      return NextResponse.json(
        { success: false, error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Email is already assigned to another account' } },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash('Welcome@123', 10);

    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          companyId,
          email,
          passwordHash,
          firstName,
          lastName,
          employeeId,
          department,
          jobTitle,
          phone,
          joinMethod: joinMethod || 'manual',
          status: 'INVITED',
          invitedAt: new Date(),
          invitedBy: user.id,
        },
        include: {
          company: { select: { id: true, name: true } },
        },
      });

      await tx.account.create({
        data: {
          authUserId: employee.id,
          email,
          role: 'EMPLOYEE',
          profileId: employee.id,
          profileType: 'EMPLOYEE',
          status: 'PENDING',
        },
      });

      await tx.auditLog.create({
        data: {
          actorType: 'admin',
          adminId: user.id,
          action: 'EMPLOYEE_CREATED',
          entityType: 'employee',
          entityId: employee.id,
          changes: { email, companyId, department },
        },
      });

      return employee;
    });

    return NextResponse.json(
      { success: true, data: result, message: 'Employee created successfully' },
      { status: 201 },
    );
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'An employee with this email already exists' } },
        { status: 409 },
      );
    }
    return internalError(error);
  }
}

// PATCH /api/admin/employees — bulk update employee status
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== 'admin') return unauthorized();

    const body = await request.json();
    const { employeeIds, status, reason } = body;

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'employeeIds must be a non-empty array' } },
        { status: 400 },
      );
    }

    if (!status || !['ACTIVE', 'INACTIVE', 'SUSPENDED', 'INELIGIBLE'].includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Invalid status. Must be one of: ACTIVE, INACTIVE, SUSPENDED, INELIGIBLE' } },
        { status: 400 },
      );
    }

    const result = await prisma.employee.updateMany({
      where: { id: { in: employeeIds }, deletedAt: null },
      data: { status: status as any },
    });

    await prisma.auditLog.create({
      data: {
        actorType: 'admin',
        adminId: user.id,
        action: `EMPLOYEES_BULK_${status}`,
        entityType: 'employee',
        entityId: `bulk-${Date.now()}`,
        changes: { employeeIds, status, reason, count: result.count },
      },
    });

    return NextResponse.json({
      success: true,
      data: { count: result.count },
      message: `${result.count} employee(s) ${status.toLowerCase()} successfully`,
    });
  } catch (error) {
    return internalError(error);
  }
}

// DELETE /api/admin/employees — soft-delete employees (single via ?id= or bulk via ?ids=a,b,c)
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== 'admin') return unauthorized();

    const { searchParams } = new URL(request.url);
    const singleId = searchParams.get('id');
    const idsParam = searchParams.get('ids');

    let employeeIds: string[];

    if (singleId) {
      employeeIds = [singleId];
    } else if (idsParam) {
      employeeIds = idsParam.split(',').filter(Boolean);
    } else {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Provide "id" for single delete or "ids" (comma-separated) for bulk delete' } },
        { status: 400 },
      );
    }

    if (employeeIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'At least one employee ID is required' } },
        { status: 400 },
      );
    }

    const result = await prisma.employee.updateMany({
      where: { id: { in: employeeIds }, deletedAt: null },
      data: { deletedAt: new Date(), deletedById: user.id, status: 'INACTIVE' },
    });

    await prisma.auditLog.create({
      data: {
        actorType: 'admin',
        adminId: user.id,
        action: employeeIds.length === 1 ? 'EMPLOYEE_DELETED' : 'EMPLOYEES_BULK_DELETED',
        entityType: 'employee',
        entityId: employeeIds.length === 1 ? employeeIds[0]! : `bulk-${Date.now()}`,
        changes: { employeeIds, count: result.count },
      },
    });

    return NextResponse.json({
      success: true,
      data: { count: result.count },
      message: `${result.count} employee(s) deleted successfully`,
    });
  } catch (error) {
    return internalError(error);
  }
}
