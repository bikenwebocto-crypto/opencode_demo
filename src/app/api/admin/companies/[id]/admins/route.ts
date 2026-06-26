import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";
import { buildAuditData, fromCurrentUser } from "@/services/audit-log.service";
import { forbidden } from "@/lib/api-auth";
import {
  assertCanDisableAdmin,
  ensurePrimaryAdmin,
  PrimaryAdminGuardError,
  summarizeAdmins,
  toAdminSummary,
} from "@/lib/company-contact";
import { validateUserEmail } from "@/services/user-validation.service";
import { sendCompanyAdminInvitation } from "@/services/company-admin-invitation.service";

function unauthorized() {
  return NextResponse.json(
    {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized" },
    },
    { status: 401 },
  );
}
function notFound(message = "Company not found") {
  return NextResponse.json(
    { success: false, error: { code: "NOT_FOUND", message } },
    { status: 404 },
  );
}
function badRequest(message: string) {
  return NextResponse.json(
    { success: false, error: { code: "VALIDATION", message } },
    { status: 400 },
  );
}
function conflict(message: string) {
  return NextResponse.json(
    { success: false, error: { code: "CONFLICT", message } },
    { status: 409 },
  );
}
function internalError(error: unknown) {
  console.error("Company admins API error:", error);
  return NextResponse.json(
    {
      success: false,
      error: { code: "INTERNAL", message: "Internal server error" },
    },
    { status: 500 },
  );
}

interface AddAdminBody {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: "OWNER" | "MEMBER";
  status?: "ACTIVE" | "INACTIVE";
}

/**
 * POST /api/admin/companies/[id]/admins
 * Create a new company admin. Auto-assigns primary if the company has
 * no active primary yet.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (user.userType !== "admin") return forbidden(user.userType);

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as AddAdminBody;
    console.log('[COMPANY_ADMIN_EMAIL][ROUTE] POST /api/admin/companies/[id]/admins', { companyId: id, email: body.email, firstName: body.firstName, lastName: body.lastName });

    const firstName = (body.firstName ?? "").trim();
    const lastName = (body.lastName ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const role = body.role === "OWNER" ? "OWNER" : "MEMBER";
    const status = body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";

    if (!firstName) return badRequest("First name is required");
    if (!lastName) return badRequest("Last name is required");
    if (!email) return badRequest("Email is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return badRequest("Invalid email address");
    }

    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true, name: true, deletedAt: true },
    });
    if (!company || company.deletedAt) return notFound();

    // Reuse the existing email validator — it checks all profile
    // tables (AdminUser, Merchant, CompanyAdmin, Employee) plus the
    // Account table. We refuse any collision.
    const validation = await validateUserEmail(email);
    if (validation.exists) {
      return conflict(
        "Email is already assigned to another account in the system",
      );
    }

    console.log('[COMPANY_ADMIN_EMAIL][ROUTE] Starting transaction');
    const result = await prisma.$transaction(async (tx) => {
      const pkId = crypto.randomUUID();
      const account = await tx.account.create({
        data: {
          authUserId: pkId,
          email,
          role: "COMPANY_ADMIN",
          profileType: "COMPANY",
          status: status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
          createdBy: user.id,
        },
      });

      const admin = await tx.companyAdmin.create({
        data: {
          id: pkId,
          companyId: id,
          accountId: account?.authUserId,
          firstName,
          lastName,
          isPrimary: false,
          isActive: status === "ACTIVE",
        },
      });

      await tx.auditLog.create({
        data: buildAuditData(
          fromCurrentUser(
            user,
            "COMPANY_ADMIN_CREATED",
            "company_admin",
            admin.id,
            {
              metadata: { companyId: id, email, role, status },
            },
          ),
        ) as any,
      });

      // Auto-fix primary: if this is the first active admin (or the
      // company has no active primary), promote it.
      await ensurePrimaryAdmin(id, tx);

      const refreshed = await tx.companyAdmin.findUnique({
        where: { id: admin.id },
      });
      const refreshedAcct = refreshed?.accountId
        ? await tx.account.findUnique({
            where: { authUserId: refreshed.accountId },
            select: { email: true },
          })
        : null;
      return { admin: refreshed, email: refreshedAcct?.email ?? "" };
    });

    console.log('[COMPANY_ADMIN_EMAIL][ROUTE] Transaction completed, calling invitation service', { email, firstName, lastName, companyName: company.name });
    await sendCompanyAdminInvitation({
      email,
      firstName,
      lastName,
      companyName: company.name ?? '',
      companyId: id,
      actorType: user.userType,
      actorId: user.profileId,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          admin: result.admin
            ? toAdminSummary(result.admin, result.email)
            : null,
        },
        message:
          "Company admin created successfully. A welcome email has been sent to the provided email address.",
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof PrimaryAdminGuardError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: error.code, message: error.message },
        },
        { status: 409 },
      );
    }
    if ((error as { code?: string })?.code === "P2002") {
      return conflict("A company admin with this email already exists");
    }
    return internalError(error);
  }
}
