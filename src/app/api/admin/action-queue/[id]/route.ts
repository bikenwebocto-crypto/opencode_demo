import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";
import { getEntityKindFromReferenceType } from "@/lib/action-queue-types";

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
    { status: 401 },
  );
}

function notFound(message = "Action queue item not found") {
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

function internalError(error: unknown) {
  console.error("Action Queue [id] API error:", error);
  return NextResponse.json(
    { success: false, error: { code: "INTERNAL", message: "Internal server error" } },
    { status: 500 },
  );
}

type EntityKind = "MERCHANT" | "MERCHANT_OFFER" | "COMPANY" | "ISSUE" | "RENEWAL_ALERT" | "UNKNOWN";

async function loadEntity(queueItem: { id: string; referenceType: string; referenceId: string; type: string; metadata: any }) {
  const meta = (queueItem.metadata as Record<string, unknown> | null) ?? {};
  const kind: EntityKind = getEntityKindFromReferenceType(queueItem.referenceType) as EntityKind;
  const isReplacement = queueItem.type === "OFFER_REPLACEMENT";

  if (kind === "MERCHANT") {
    return prisma.merchant.findUnique({
      where: { id: queueItem.referenceId },
      include: { category: true },
    });
  }

  if (kind === "MERCHANT_OFFER") {
    const offerId = (meta.offerId as string | undefined) ?? (meta.newOfferId as string | undefined) ?? queueItem.referenceId;
    const offer = await prisma.merchantOffer.findUnique({
      where: { id: offerId },
      include: {
        merchant: {
          select: {
            id: true, businessName: true, email: true, status: true, logoUrl: true,
            city: true, state: true, categoryId: true, contactName: true, contactPhone: true,
            description: true, website: true, addressLine1: true, addressLine2: true, postalCode: true,
          },
        },
        replacesOffer: true,
      },
    });

    if (isReplacement && meta.currentOfferId) {
      const currentOffer = await prisma.merchantOffer.findUnique({
        where: { id: meta.currentOfferId as string },
        include: {
          merchant: {
            select: { id: true, businessName: true, email: true, status: true, logoUrl: true, city: true, state: true },
          },
        },
      });
      return { ...offer, currentOffer };
    }
    return offer;
  }

  if (kind === "COMPANY") {
    return prisma.company.findUnique({
      where: { id: queueItem.referenceId },
      include: {
        billing: true,
        _count: { select: { employees: true } },
      },
    });
  }

  if (kind === "ISSUE") {
    const issueId = (meta.issueId as string | undefined) ?? queueItem.referenceId;
    return prisma.issueReport.findUnique({
      where: { id: issueId },
      include: {
        merchant: { select: { id: true, businessName: true, email: true, status: true, city: true } },
        employee: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  if (kind === "RENEWAL_ALERT") {
    const alertId = (meta.alertId as string | undefined) ?? queueItem.referenceId;
    return prisma.renewalGamingAlert.findUnique({
      where: { id: alertId },
    });
  }

  return null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== "admin") return unauthorized();

    const { id } = await params;

    const queueItem = await prisma.actionQueueItem.findUnique({
      where: { id },
      include: {
        merchant: { select: { id: true, businessName: true, email: true } },
      },
    });

    if (!queueItem) return notFound();

    const entity = await loadEntity(queueItem);

    const auditLogs = await prisma.auditLog.findMany({
      where: { entityType: "action_queue", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        admin: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: { queueItem, entity, auditLogs },
    });
  } catch (error) {
    return internalError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== "admin") return unauthorized();

    const { id } = await params;
    const body = await request.json();
    const { action, rejectionReason, remark, edits } = body;

    if (!action) return badRequest("Action is required");

    const queueItem = await prisma.actionQueueItem.findUnique({ where: { id } });
    if (!queueItem) return notFound();

    if (queueItem.status === "COMPLETED" || queueItem.status === "FAILED") {
      return badRequest("This item has already been finalized");
    }

    const adminId = user.id;
    const now = new Date();

    if (action === "APPROVE") {
      await performApprove(queueItem, adminId, now);
      return NextResponse.json({ success: true, message: "Item approved" });
    }

    if (action === "REJECT") {
      if (!rejectionReason?.trim()) return badRequest("Rejection reason is required");
      await performReject(queueItem, adminId, rejectionReason.trim(), now);
      return NextResponse.json({ success: true, message: "Item rejected" });
    }

    if (action === "REMARK") {
      if (!remark?.trim()) return badRequest("Remark is required");
      await performRemark(queueItem, adminId, remark.trim());
      return NextResponse.json({ success: true, message: "Remark added" });
    }

    if (action === "EDIT_AND_APPROVE") {
      if (!edits || typeof edits !== "object") return badRequest("Edits object is required");
      await performEditAndApprove(queueItem, adminId, edits, now);
      return NextResponse.json({ success: true, message: "Item edited and approved" });
    }

    return badRequest(`Unknown action: ${action}`);
  } catch (error) {
    return internalError(error);
  }
}

async function performApprove(
  queueItem: any,
  adminId: string,
  now: Date,
) {
  const meta =
    (queueItem.metadata as Record<string, any> | null) ?? {};

  const previousStatus = queueItem.status;

  console.log("================================");
  console.log("APPROVE ACTION QUEUE");
  console.log({
    queueId: queueItem.id,
    type: queueItem.type,
    referenceType: queueItem.referenceType,
    referenceId: queueItem.referenceId,
    adminId,
  });
  console.log("================================");

  switch (queueItem.type) {
    /**
     * Merchant application approval
     */
    case "MERCHANT_APPLICATION": {
      const merchant = await prisma.merchant.findUnique({
        where: { id: queueItem.referenceId },
      });

      if (!merchant) {
        throw new Error(
          `Merchant not found: ${queueItem.referenceId}`,
        );
      }

      await prisma.merchant.update({
        where: { id: merchant.id },
        data: {
          status: "ACTIVE",
          approvedAt: now,
          approvedById: adminId,
        },
      });

      await prisma.merchantStatusHistory.create({
        data: {
          merchantId: merchant.id,
          fromStatus: merchant.status,
          toStatus: "ACTIVE",
          changedBy: adminId,
          changedByType: "admin",
          reason: "Approved via action queue",
        },
      });

      break;
    }

    /**
     * First offer approval
     */
    case "OFFER_APPROVAL": {
      const offerId =
        meta.offerId ??
        queueItem.referenceId;

      const offer = await prisma.merchantOffer.findUnique({
        where: { id: offerId },
      });

      if (!offer) {
        throw new Error(`Offer not found: ${offerId}`);
      }

      await prisma.merchantOffer.update({
        where: { id: offer.id },
        data: {
          status: "LIVE",
          liveAt: now,
          reviewedAt: now,
          reviewedBy: adminId,
        },
      });

      await prisma.merchant.update({
        where: { id: offer.merchantId },
        data: {
          status: "ACTIVE",
          approvedAt: now,
          approvedById: adminId,
        },
      });

      console.log("Offer approved:", offer.id);

      break;
    }

    /**
     * Replacement offer approval
     */
    case "OFFER_REPLACEMENT": {
      const newOfferId =
        meta.newOfferId ??
        meta.offerId ??
        queueItem.referenceId;

      const newOffer = await prisma.merchantOffer.findUnique({
        where: { id: newOfferId },
      });

      if (!newOffer) {
        throw new Error(
          `Replacement offer not found: ${newOfferId}`,
        );
      }

      const oldOfferId =
        meta.currentOfferId ??
        newOffer.replacesOfferId;

      if (oldOfferId) {
        await prisma.merchantOffer.update({
          where: { id: oldOfferId },
          data: {
            status: "ARCHIVED",
          },
        });

        console.log(
          "Old offer archived:",
          oldOfferId,
        );
      }

      await prisma.merchantOffer.update({
        where: { id: newOffer.id },
        data: {
          status: "LIVE",
          liveAt: now,
          reviewedAt: now,
          reviewedBy: adminId,
        },
      });

      console.log(
        "Replacement offer activated:",
        newOffer.id,
      );

      break;
    }

    /**
     * Company activation
     */
    case "COMPANY_ACTIVATION": {
      const company = await prisma.company.findUnique({
        where: { id: queueItem.referenceId },
      });

      if (!company) {
        throw new Error(
          `Company not found: ${queueItem.referenceId}`,
        );
      }

      await prisma.company.update({
        where: { id: company.id },
        data: {
          status: "ACTIVE",
          approvedAt: now,
        },
      });

      await prisma.companyStatusHistory.create({
        data: {
          companyId: company.id,
          fromStatus: company.status,
          toStatus: "ACTIVE",
          changedBy: adminId,
          changedByType: "admin",
          reason: "Approved via action queue",
        },
      });

      break;
    }

    /**
     * Issue resolution
     */
    case "ISSUE_REVIEW": {
      const issueId =
        meta.issueId ??
        queueItem.referenceId;

      await prisma.issueReport.update({
        where: { id: issueId },
        data: {
          status: "RESOLVED",
          resolvedAt: now,
          adminId,
        },
      });

      break;
    }

    /**
     * Renewal alert
     */
    case "RENEWAL_ALERT": {
      const alertId =
        meta.alertId ??
        queueItem.referenceId;

      await prisma.renewalGamingAlert.update({
        where: { id: alertId },
        data: {
          isDismissed: true,
        },
      });

      break;
    }

    default:
      throw new Error(
        `Unsupported queue type: ${queueItem.type}`,
      );
  }

  await prisma.actionQueueItem.update({
    where: { id: queueItem.id },
    data: {
      status: "COMPLETED",
      completedAt: now,
      metadata: {
        ...(queueItem.metadata ?? {}),
        approvedAt: now.toISOString(),
        approvedBy: adminId,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      adminId,
      action: "ACTION_QUEUE_APPROVED",
      entityType: "ACTION_QUEUE",
      entityId: queueItem.id,
      changes: {
        from: previousStatus,
        to: "COMPLETED",
        queueType: queueItem.type,
      } as any,
    },
  });

  console.log(
    `Queue ${queueItem.id} completed successfully`,
  );
}

async function performReject(queueItem: any, adminId: string, rejectionReason: string, now: Date) {
  const kind: EntityKind = getEntityKindFromReferenceType(queueItem.referenceType) as EntityKind;
  const meta = (queueItem.metadata as Record<string, unknown> | null) ?? {};
  const previousStatus = queueItem.status;

  if (kind === "MERCHANT_OFFER") {
    const offerId = (meta.offerId as string | undefined) ?? (meta.newOfferId as string | undefined) ?? queueItem.referenceId;
    const offer = await prisma.merchantOffer.findUnique({ where: { id: offerId } });
    if (offer) {
      await prisma.merchantOffer.update({
        where: { id: offer.id },
        data: { status: "REJECTED", rejectionReason, reviewedAt: now, reviewedBy: adminId },
      });
    }
  } else if (kind === "MERCHANT") {
    const merchant = await prisma.merchant.findUnique({ where: { id: queueItem.referenceId } });
    if (merchant) {
      await prisma.merchant.update({
        where: { id: merchant.id },
        data: { status: "REJECTED", rejectionReason },
      });
    }
  } else if (kind === "COMPANY") {
    await prisma.company.update({
      where: { id: queueItem.referenceId },
      data: { status: "SUSPENDED" },
    });
  }

  await prisma.actionQueueItem.update({
    where: { id: queueItem.id },
    data: {
      status: "FAILED",
      completedAt: now,
      metadata: {
        ...(queueItem.metadata as any ?? {}),
        rejectionReason,
        rejectedBy: adminId,
        rejectedAt: now.toISOString(),
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      adminId,
      action: "ACTION_QUEUE_REJECTED",
      entityType: "action_queue",
      entityId: queueItem.id,
      changes: { from: previousStatus, to: "FAILED", reason: rejectionReason, entityKind: kind } as any,
    },
  });
}

async function performRemark(queueItem: any, adminId: string, remark: string) {
  const existingMeta = (queueItem.metadata as any) ?? {};
  const remarks = Array.isArray(existingMeta.remarks) ? existingMeta.remarks : [];
  remarks.push({ text: remark, by: adminId, at: new Date().toISOString() });

  await prisma.actionQueueItem.update({
    where: { id: queueItem.id },
    data: { metadata: { ...existingMeta, remarks } as any },
  });

  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      adminId,
      action: "ACTION_QUEUE_REMARK_ADDED",
      entityType: "action_queue",
      entityId: queueItem.id,
      changes: { remark } as any,
    },
  });
}

async function performEditAndApprove(queueItem: any, adminId: string, edits: Record<string, unknown>, now: Date) {
  const kind: EntityKind = getEntityKindFromReferenceType(queueItem.referenceType) as EntityKind;
  const meta = (queueItem.metadata as Record<string, unknown> | null) ?? {};

  if (kind === "MERCHANT_OFFER") {
    const offerId = (meta.offerId as string | undefined) ?? (meta.newOfferId as string | undefined) ?? queueItem.referenceId;
    const allowed = [
      "title", "description", "shortDescription", "termsAndConditions",
      "discountValue", "discountPercent", "minimumSpend", "maxRedemptions",
      "startDate", "endDate",
    ];
    const updateData: Record<string, unknown> = {};
    for (const key of allowed) {
      if (edits[key] !== undefined && edits[key] !== null && edits[key] !== "") {
        updateData[key] = edits[key];
      }
    }
    if (Object.keys(updateData).length > 0) {
      await prisma.merchantOffer.update({
        where: { id: offerId },
        data: { ...updateData } as any,
      });
    }
  } else if (kind === "MERCHANT") {
    const allowed = [
      "businessName", "contactName", "contactPhone", "description", "email",
      "website", "city", "state", "addressLine1", "addressLine2", "postalCode",
    ];
    const updateData: Record<string, unknown> = {};
    for (const key of allowed) {
      if (edits[key] !== undefined && edits[key] !== null && edits[key] !== "") {
        updateData[key] = edits[key];
      }
    }
    if (Object.keys(updateData).length > 0) {
      await prisma.merchant.update({
        where: { id: queueItem.referenceId },
        data: { ...updateData } as any,
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      adminId,
      action: "ACTION_QUEUE_EDITED",
      entityType: "action_queue",
      entityId: queueItem.id,
      changes: { edits, entityKind: kind } as any,
    },
  });

  await performApprove(queueItem, adminId, now);
}
