import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { internalError, notFound, badRequest } from "@/lib/employee-helpers";
import { getAuthenticatedMobileEmployee } from "@/lib/mobile-auth";
import { createAuditLog } from "@/services/audit-log.service";
import { uploadImage, EMPLOYEE_AVATAR_OPTIONS } from '@/lib/upload/image'

// GET /api/mobile/profile — lightweight employee profile for the mobile Profile tab.
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedMobileEmployee(request);
    if (!auth.ok) return auth.response;

    const [countOfRedemption, merchantRedemptions] = await Promise.all([
      prisma.redemption.count({ where: { employeeId: auth.employee.id } }),
      prisma.redemption.findMany({
        where: { employeeId: auth.employee.id },
        select: { merchantId: true },
        distinct: ["merchantId"],
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        id: auth.employee.id,
        firstName: auth.employee.firstName,
        lastName: auth.employee.lastName,
        employeeId: auth.employee.employeeId,
        avatarUrl: auth.employee.avatarUrl,
        department: auth.employee.department,
        jobTitle: auth.employee.jobTitle,
        status: auth.employee.status,
        phone: auth.employee?.phone,
        count_of_redemption: countOfRedemption,
        count_of_merchant_itredeemed: merchantRedemptions.length,
        company: {
          id: auth.company.id,
          name: auth.company.name,
          logoUrl: auth.company.logoUrl,
        },
        account: {
          email: auth.account.email,
        },
      },
    });
  } catch (error) {
    return internalError(error);
  }
}

// PATCH /api/mobile/profile — update profile fields from multipart form-data.
// Text fields: firstName, lastName, phone, jobTitle, department.
// File field: avatar (single image, uploaded to Supabase Storage).
export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthenticatedMobileEmployee(request);
    if (!auth.ok) return auth.response;

    const form = await request.formData();

    const allowed = [
      "firstName",
      "lastName",
      "phone",
      "jobTitle",
      "department",
    ] as const;

    const update: Record<string, unknown> = {};
    for (const f of allowed) {
      const val = form.get(f);
      if (val !== null && typeof val === "string") update[f] = val;
    }

    const avatarFile = form.get("avatar");
    if (avatarFile && avatarFile instanceof File && avatarFile.size > 0) {
      const url = await uploadImage(avatarFile, EMPLOYEE_AVATAR_OPTIONS);
      update.avatarUrl = url;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: true, message: "No changes" });
    }

    if (
      update.firstName !== undefined &&
      (!update.firstName || String(update.firstName).trim().length < 1)
    ) {
      return badRequest("First name is required");
    }
    if (
      update.lastName !== undefined &&
      (!update.lastName || String(update.lastName).trim().length < 1)
    ) {
      return badRequest("Last name is required");
    }

    const updated = await prisma.employee.update({
      where: { id: auth.employee.id },
      data: update,
    });

    void createAuditLog({
      actorType: "employee",
      actorId: auth.employee.id,
      action: "EMPLOYEE_PROFILE_UPDATED",
      entityType: "employee",
      entityId: auth.employee.id,
      metadata: { changed: Object.keys(update), loginSource: "mobile" },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return internalError(error);
  }
}
