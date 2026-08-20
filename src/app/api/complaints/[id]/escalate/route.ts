import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAdmin, handleApiError } from "@/app/api/company/helpers";
import { createAuditLog } from "@/services/audit-log.service";

function unauthorized() {
  return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
}

function notFound(message = "Not found") {
  return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message } }, { status: 404 });
}

function badRequest(message: string) {
  return NextResponse.json({ success: false, error: { code: "VALIDATION", message } }, { status: 400 });
}

function internalError(error: unknown) {
  console.error("Escalate complaint error:", error);
  return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "Internal server error" } }, { status: 500 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    let companyAdminData;
    try {
      companyAdminData = await getCompanyAdmin();
    } catch (err) {
      return handleApiError(err);
    }

    const { company, companyAdmin } = companyAdminData;
    const { id } = await params;

    const body = await request.json();
    const { reason } = body;

    if (!reason || !reason.trim()) {
      return badRequest("Reason is required for escalation");
    }

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) return notFound("Complaint not found");
    if (complaint.companyId !== company.id) return notFound("Complaint not found");
    if (complaint.status === "RESOLVED" || complaint.status === "REJECTED") {
      return badRequest("Cannot escalate a resolved or rejected complaint");
    }

    const result = await prisma.$transaction(async (tx) => {
      const escalation = await tx.complaintEscalation.create({
        data: {
          complaintId: id,
          companyAdminId: companyAdmin.id,
          reason,
          status: "PENDING",
        },
      });

      await tx.complaintAction.create({
        data: {
          complaintId: id,
          actorType: "COMPANY_ADMIN",
          companyAdminId: companyAdmin.id,
          actionType: "ESCALATED",
          notes: reason,
        },
      });

      await tx.complaint.update({
        where: { id },
        data: { status: "ESCALATED", escalationNote: reason, updatedAt: new Date() },
      });

      return escalation;
    });

    await createAuditLog({
      actorType: "company_admin",
      actorId: companyAdmin.id,
      action: "COMPLAINT_ESCALATED",
      entityType: "COMPLAINT",
      entityId: id,
      metadata: { reason, companyId: company.id },
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return internalError(error);
  }
}
