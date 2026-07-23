import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAuditLog } from "@/services/audit-log.service";

function unauthorized() {
  return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
}

function notFound(entity: string) {
  return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: `${entity} not found` } }, { status: 404 });
}

function badRequest(message: string) {
  return NextResponse.json({ success: false, error: { code: "VALIDATION", message } }, { status: 400 });
}

function internalError(error: unknown) {
  console.error("Admin complaint detail error:", error);
  return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "Internal server error" } }, { status: 500 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== "admin") return unauthorized();

    const { id } = await params;

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        offer: { select: { id: true, title: true, status: true, offerType: true } },
        merchant: { select: { id: true, businessName: true, logoUrl: true, city: true, state: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
        company: { select: { id: true, name: true, email: true } },
        actions: { orderBy: { createdAt: "desc" } },
        escalations: {
          orderBy: { createdAt: "desc" },
          include: {
            companyAdmin: { select: { id: true, firstName: true, lastName: true } },
            superAdmin: { select: { id: true } },
          },
        },
      },
    });

    if (!complaint) return notFound("Complaint");

    return NextResponse.json({ success: true, data: complaint });
  } catch (error) {
    return internalError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== "admin") return unauthorized();

    const { id } = await params;
    const body = await request.json();
    const { status, resolutionNotes } = body;

    if (!status || !["RESOLVED", "REJECTED"].includes(status)) {
      return badRequest("Status must be RESOLVED or REJECTED");
    }

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) return notFound("Complaint");

    if (complaint.status === "RESOLVED" || complaint.status === "REJECTED") {
      return badRequest("Complaint is already resolved or rejected");
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.complaint.update({
        where: { id },
        data: {
          status,
          resolutionNotes: resolutionNotes ?? null,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      if (status === "RESOLVED") {
        await tx.complaintEscalation.updateMany({
          where: { complaintId: id, status: "PENDING" },
          data: { status: "RESOLVED", superAdminId: user.profileId ?? user.id, resolvedAt: new Date() },
        });
      }

      await tx.complaintAction.create({
        data: {
          complaintId: id,
          actorType: "SUPER_ADMIN",
          adminId: user.profileId ?? user.id,
          actionType: status === "RESOLVED" ? "RESOLVED" : "REJECTED",
          notes: resolutionNotes ?? null,
        },
      });

      return updated;
    });

    await createAuditLog({
      actorType: "admin",
      actorId: user.profileId ?? user.id,
      action: status === "RESOLVED" ? "COMPLAINT_RESOLVED" : "COMPLAINT_REJECTED",
      entityType: "COMPLAINT",
      entityId: id,
      metadata: { previousStatus: complaint.status, resolutionNotes },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return internalError(error);
  }
}
