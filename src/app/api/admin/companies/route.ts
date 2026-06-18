import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/supabase/server';
import { adminCompanyActionSchema } from '@/schemas';
import * as bcrypt from 'bcryptjs';
import { validateUserEmail } from '@/services/user-validation.service';
import { getCityReadiness } from '@/lib/company-activation/city-readiness';
import { sendLaunchPack } from '@/lib/company-activation/launch-pack';
import { derivePrimaryAdmin, summarizeAdmins } from '@/lib/company-contact';
import type { CompanyStatus } from '@/types';

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
//
// Query params:
//   - status      : company status (ALL | PENDING | ACTIVE | PAUSED | SUSPENDED | CANCELLED | APPROVED_PENDING_PAYMENT)
//   - adminStatus : filter to companies whose primary admin is ACTIVE/INACTIVE
//   - page, pageSize
//   - q           : free-text search across company name, company contact email, and admin email
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (user.userType !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const adminStatus = searchParams.get('adminStatus');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20')));
    const q = searchParams.get('q');

    const where: Record<string, unknown> = { deletedAt: null };
    if (status && status !== 'ALL') where.status = status as CompanyStatus;

    // When adminStatus='ACTIVE'|'INACTIVE', restrict to companies that have
    // at least one admin matching that flag. We resolve those company IDs
    // up-front to keep the main query simple.
    if (adminStatus === 'ACTIVE' || adminStatus === 'INACTIVE') {
      const isActive = adminStatus === 'ACTIVE'
      const matchingAdmins = await prisma.companyAdmin.findMany({
        where: { isActive },
        select: { companyId: true },
        distinct: ['companyId'],
      })
      where.id = { in: matchingAdmins.map((a) => a.companyId) }
    }

    // Free-text search: company name, company contact email, or any
    // matching company admin email. We pre-resolve admin email matches
    // into company IDs and OR them into the where clause.
    if (q && q.trim()) {
      const term = q.trim()
      const matchingAdmins = await prisma.companyAdmin.findMany({
        where: { email: { contains: term, mode: 'insensitive' } },
        select: { companyId: true },
        distinct: ['companyId'],
      })
      const adminEmailCompanyIds = matchingAdmins.map((a) => a.companyId)

      const orClauses: Record<string, unknown>[] = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ]
      if (adminEmailCompanyIds.length > 0) {
        orClauses.push({ id: { in: adminEmailCompanyIds } })
      }

      // Combine with adminStatus id-in filter if both present.
      const existingIdIn = (where.id as { in?: string[] } | undefined)?.in
      if (existingIdIn) {
        const intersected = adminEmailCompanyIds.length > 0
          ? adminEmailCompanyIds.filter((id) => existingIdIn.includes(id))
          : existingIdIn
        where.id = { in: intersected }
        delete (where as any).OR
        where.AND = [{ OR: orClauses }]
      } else {
        where.OR = orClauses
      }
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
          companyAdmins: {
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      prisma.company.count({ where: where as any }),
    ]);

    const data = companies.map((c) => {
      const admins = summarizeAdmins(c.companyAdmins)
      const activeAdmins = admins.filter((a) => a.isActive)
      const primaryAdmin = derivePrimaryAdmin(c.companyAdmins)
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        website: c.website,
        city: c.city,
        country: c.country,
        industry: c.industry,
        logoUrl: c.logoUrl,
        status: c.status,
        employeeCount: c._count?.employees ?? 0,
        activeRedemptions: c._count?.redemptions ?? 0,
        joinedAt: c.createdAt,
        createdAt: c.createdAt,
        billing: c.billing,
        companyContact: {
          id: c.id,
          companyName: c.name,
          companyEmail: c.email,
          phone: c.phone,
          website: c.website,
          status: c.status,
          city: c.city,
          country: c.country,
          industry: c.industry,
          logoUrl: c.logoUrl,
          employeeCount: c._count?.employees ?? 0,
          createdAt: c.createdAt,
        },
        primaryAdmin,
        admins,
        adminCount: admins.length,
        activeAdminCount: activeAdmins.length,
      }
    })

    return NextResponse.json({
      success: true,
      data,
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
          status: 'APPROVED_PENDING_PAYMENT',
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
          profileType: 'COMPANY',
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
        {
          success: true,
          data: result,
          message:
            'Company created successfully. Use the company detail page to set the city and then mark the company ACTIVE (which will trigger the city-readiness gate and dispatch the launch pack).',
        },
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

    // City Readiness Gate: cannot transition to ACTIVE unless the
    // headquarters city meets the merchant/category thresholds.
    if (status === 'ACTIVE') {
      const readiness = await getCityReadiness(existing.city)
      if (!readiness.ready) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CITY_NOT_READY',
              message: readiness.message,
              details: readiness,
            },
          },
          { status: 422 }
        )
      }
    }

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

    // Dispatch the launch pack on a successful first-time activation.
    if (status === 'ACTIVE' && previousStatus !== 'ACTIVE') {
      try {
        await sendLaunchPack(companyId, user.id)
      } catch (err) {
        console.error('Launch pack failed for company', companyId, err)
      }
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
