import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getEmployeeFromSession,
  unauthorized,
  companyInactive,
  notFound,
  badRequest,
  internalError,
} from "@/lib/employee-session";
import { createAuditLog } from "@/services/audit-log.service";
import { getCurrentUser } from "@/lib/supabase/server";

const VALID_TYPES = [
  "MISLEADING",
  "INVALID_TERMS",
  "NON_FUNCTIONAL",
  "POLICY_VIOLATION",
] as const;
const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export async function POST(request: NextRequest) {
  try {
    const employee = await getEmployeeFromSession();
    if (!employee) return unauthorized();
    if ("inactive" in employee) return companyInactive(employee.companyStatus);

    const body = await request.json();
    const { offerId, complaintType, description, evidenceUrls, priority } =
      body;

    if (!offerId || !complaintType || !description) {
      return badRequest(
        "Missing required fields: offerId, complaintType, description",
      );
    }

    if (!VALID_TYPES.includes(complaintType)) {
      return badRequest(
        "Invalid complaintType. Must be one of: " + VALID_TYPES.join(", "),
      );
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return badRequest(
        "Invalid priority. Must be one of: " + VALID_PRIORITIES.join(", "),
      );
    }

    const offer = await prisma.merchantOffer.findUnique({
      where: { id: offerId },
      select: {
        id: true,
        merchantId: true,
        merchant: { select: { id: true } },
      },
    });
    if (!offer) return notFound("Offer not found");

    const complaint = await prisma.$transaction(async (tx) => {
      const c = await tx.complaint.create({
        data: {
          offerId,
          employeeId: employee.id,
          merchantId: offer.merchantId,
          companyId: employee.companyId,
          complaintType,
          description,
          evidenceUrls: evidenceUrls ?? null,
          priority: priority ?? "MEDIUM",
        },
      });

      await tx.complaintAction.create({
        data: {
          complaintId: c.id,
          actorType: "EMPLOYEE",
          employeeId: employee.id,
          actionType: "REVIEWED",
          notes: "Complaint filed",
        },
      });

      return c;
    });

    await createAuditLog({
      actorType: "employee",
      employeeId: employee.id,
      action: "COMPLAINT_CREATED",
      entityType: "COMPLAINT",
      entityId: complaint.id,
      metadata: { complaintType, offerId },
    });

    return NextResponse.json(
      { success: true, data: complaint },
      { status: 201 },
    );
  } catch (error) {
    return internalError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    // if ("inactive" in employee) return companyInactive(employee.companyStatus);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(
      50,
      Math.max(1, Number(searchParams.get("pageSize") ?? "20")),
    );
    const status = searchParams.get("status");
    let where: any = {};
    let include: any = {};
    console.log("@@User role:", user.profileId, user.role); // Log the user role for debugging
    switch (user?.role) {
      case "EMPLOYEE":
        console.log("Employee user:", user.role, user?.profileId);
        where = { employeeId: user?.profileId };
        include = {
          offer: { select: { id: true, title: true } },
          merchant: { select: { id: true, businessName: true, logoUrl: true } },
          actions: { orderBy: { createdAt: "desc" }, take: 5 },
        };
        break;
      case "MERCHANT":
        console.log("Merchant user:", user.role , user?.profileId);
        where = { merchantId: user?.profileId };
        include = {
          offer: { select: { id: true, title: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
          actions: { orderBy: { createdAt: "desc" }, take: 5 },
        };
        break;
      case "ADMIN":
        return unauthorized();
    }

    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include,
      }),
      prisma.complaint.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return internalError(error);
  }
}
