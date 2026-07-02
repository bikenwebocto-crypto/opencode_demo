import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/services/audit-log.service";
import { getCurrentUser } from "@/lib/supabase/server";
import { getEntityKindFromReferenceType } from "@/lib/action-queue-types";

function unauthorized() {
  return NextResponse.json(
    {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized" },
    },
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
    {
      success: false,
      error: { code: "INTERNAL", message: "Internal server error" },
    },
    { status: 500 },
  );
}

type EntityKind =
  | "MERCHANT"
  | "MERCHANT_OFFER"
  | "COMPANY"
  | "ISSUE"
  | "RENEWAL_ALERT"
  | "UNKNOWN";

async function loadEntity(queueItem: {
  id: string;
  referenceType: string;
  referenceId: string;
  type: string;
  metadata: any;
}) {
  const meta = (queueItem.metadata as Record<string, unknown> | null) ?? {};
  const kind: EntityKind = getEntityKindFromReferenceType(
    queueItem.referenceType,
  ) as EntityKind;
  const isReplacement = queueItem.type === "OFFER_REPLACEMENT";

  if (kind === "MERCHANT") {
    return prisma.merchant.findUnique({
      where: { id: queueItem.referenceId },
      include: { category: true },
    });
  }

  if (kind === "MERCHANT_OFFER") {
    const offerId =
      (meta.offerId as string | undefined) ??
      (meta.newOfferId as string | undefined) ??
      queueItem.referenceId;
    const offer = await prisma.merchantOffer.findUnique({
      where: { id: offerId },
      include: {
        merchant: {
          select: {
            id: true,
            businessName: true,
            status: true,
            logoUrl: true,
            city: true,
            state: true,
            categoryId: true,
            contactName: true,
            contactPhone: true,
            description: true,
            website: true,
            addressLine1: true,
            addressLine2: true,
            postalCode: true,
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
            select: {
              id: true,
              businessName: true,
              status: true,
              logoUrl: true,
              city: true,
              state: true,
            },
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
    const issueId =
      (meta.issueId as string | undefined) ?? queueItem.referenceId;
    return prisma.issueReport.findUnique({
      where: { id: issueId },
      include: {
        merchant: {
          select: { id: true, businessName: true, status: true, city: true },
        },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  if (kind === "RENEWAL_ALERT") {
    const alertId =
      (meta.alertId as string | undefined) ?? queueItem.referenceId;
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
        merchant: { select: { id: true, businessName: true } },
      },
    });

    if (!queueItem) return notFound();

    const entity = await loadEntity(queueItem);

    const auditLogs = await prisma.auditLog.findMany({
      where: { entityType: "action_queue", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        admin: { select: { id: true, firstName: true, lastName: true } },
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

    const queueItem = await prisma.actionQueueItem.findUnique({
      where: { id },
    });
    if (!queueItem) return notFound();

    if (queueItem.status === "COMPLETED" || queueItem.status === "FAILED") {
      return badRequest("This item has already been finalized");
    }

    if (!user.profileId) return badRequest("Admin profile not found");
    const adminId = user.profileId;
    const now = new Date();

    if (action === "APPROVE") {
      await performApprove(queueItem, adminId, now);
      return NextResponse.json({ success: true, message: "Item approved" });
    }

    if (action === "REJECT") {
      if (!rejectionReason?.trim())
        return badRequest("Rejection reason is required");
      await performReject(queueItem, adminId, rejectionReason.trim(), now);
      return NextResponse.json({ success: true, message: "Item rejected" });
    }

    if (action === "REMARK") {
      if (!remark?.trim()) return badRequest("Remark is required");
      await performRemark(queueItem, adminId, remark.trim());
      return NextResponse.json({ success: true, message: "Remark added" });
    }

    if (action === "EDIT_AND_APPROVE") {
      if (!edits || typeof edits !== "object")
        return badRequest("Edits object is required");
      await performEditAndApprove(queueItem, adminId, edits, now);
      return NextResponse.json({
        success: true,
        message: "Item edited and approved",
      });
    }

    return badRequest(`Unknown action: ${action}`);
  } catch (error) {
    return internalError(error);
  }
}

async function performApprove(queueItem: any, adminId: string, now: Date) {
  console.log("========================================");
  console.log("🔍 APPROVE ACTION QUEUE - START");
  console.log("========================================");
  console.log(`[${new Date().toISOString()}] Processing approval`);
  console.log({
    queueId: queueItem.id,
    type: queueItem.type,
    referenceType: queueItem.referenceType,
    referenceId: queueItem.referenceId,
    adminId,
    queueItemStatus: queueItem.status,
    queueItemMetadata: queueItem.metadata,
  });
  console.log("========================================");

  const meta = (queueItem.metadata as Record<string, any> | null) ?? {};

  const previousStatus = queueItem.status;

  try {
    switch (queueItem.type) {
      /**
       * Merchant application approval
       */
      case "MERCHANT_APPLICATION": {
        console.log("[MERCHANT_APPLICATION] Starting merchant approval...");
        console.log(
          `[MERCHANT_APPLICATION] Reference ID: ${queueItem.referenceId}`,
        );

        const merchant = await prisma.merchant.findUnique({
          where: { id: queueItem.referenceId },
        });

        if (!merchant) {
          console.error(
            `[MERCHANT_APPLICATION] ❌ Merchant not found: ${queueItem.referenceId}`,
          );
          throw new Error(`Merchant not found: ${queueItem.referenceId}`);
        }

        console.log(`[MERCHANT_APPLICATION] ✅ Merchant found:`, {
          id: merchant.id,
          businessName: merchant.businessName,
          status: merchant.status,
          email: merchant,
        });

        await prisma.merchant.update({
          where: { id: merchant.id },
          data: {
            status: "ACTIVE",
            approvedAt: now,
            approvedById: adminId,
          },
        });
        console.log(`[MERCHANT_APPLICATION] ✅ Merchant status updated`);

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
        console.log(`[MERCHANT_APPLICATION] ✅ Status history created`);

        break;
      }

      /**
       * First offer approval
       */
      case "OFFER_APPROVAL": {
        const offerId = meta.offerId ?? queueItem.referenceId;

        console.log(`[OFFER_APPROVAL] Starting offer approval...`);
        console.log(`[OFFER_APPROVAL] Offer ID: ${offerId}`);

        const offer = await prisma.merchantOffer.findUnique({
          where: { id: offerId },
        });

        if (!offer) {
          console.error(`[OFFER_APPROVAL] ❌ Offer not found: ${offerId}`);
          throw new Error(`Offer not found: ${offerId}`);
        }

        console.log(`[OFFER_APPROVAL] ✅ Offer found:`, {
          id: offer.id,
          title: offer.title,
          status: offer.status,
          merchantId: offer.merchantId,
        });

        await prisma.merchantOffer.update({
          where: { id: offer.id },
          data: {
            status: "LIVE",
            liveAt: now,
            reviewedAt: now,
            reviewedBy: adminId,
          },
        });
        console.log(`[OFFER_APPROVAL] ✅ Offer updated to LIVE`);

        await prisma.merchant.update({
          where: { id: offer.merchantId },
          data: {
            status: "ACTIVE",
            approvedAt: now,
            approvedById: adminId,
          },
        });
        console.log(`[OFFER_APPROVAL] ✅ Merchant updated to ACTIVE`);

        break;
      }

      /**
       * Replacement offer approval
       */
      case "OFFER_REPLACEMENT": {
        const newOfferId =
          meta.newOfferId ?? meta.offerId ?? queueItem.referenceId;

        console.log(
          `[OFFER_REPLACEMENT] Starting replacement offer approval...`,
        );
        console.log(`[OFFER_REPLACEMENT] New Offer ID: ${newOfferId}`);

        const newOffer = await prisma.merchantOffer.findUnique({
          where: { id: newOfferId },
        });

        if (!newOffer) {
          console.error(
            `[OFFER_REPLACEMENT] ❌ Replacement offer not found: ${newOfferId}`,
          );
          throw new Error(`Replacement offer not found: ${newOfferId}`);
        }

        console.log(`[OFFER_REPLACEMENT] ✅ New offer found:`, {
          id: newOffer.id,
          title: newOffer.title,
          status: newOffer.status,
          merchantId: newOffer.merchantId,
          replacesOfferId: newOffer.replacesOfferId,
        });

        const oldOfferId = meta.currentOfferId ?? newOffer.replacesOfferId;

        if (oldOfferId) {
          console.log(`[OFFER_REPLACEMENT] Archiving old offer: ${oldOfferId}`);

          await prisma.merchantOffer.update({
            where: { id: oldOfferId },
            data: {
              status: "ARCHIVED",
            },
          });
          console.log(
            `[OFFER_REPLACEMENT] ✅ Old offer archived: ${oldOfferId}`,
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
          `[OFFER_REPLACEMENT] ✅ Replacement offer activated: ${newOffer.id}`,
        );

        break;
      }

      /**
       * Company activation
       */
      case "COMPANY_ACTIVATION": {
        console.log(`[COMPANY_ACTIVATION] Starting company activation...`);
        console.log(
          `[COMPANY_ACTIVATION] Reference ID: ${queueItem.referenceId}`,
        );

        const company = await prisma.company.findUnique({
          where: { id: queueItem.referenceId },
        });

        if (!company) {
          console.error(
            `[COMPANY_ACTIVATION] ❌ Company not found: ${queueItem.referenceId}`,
          );
          throw new Error(`Company not found: ${queueItem.referenceId}`);
        }

        console.log(`[COMPANY_ACTIVATION] ✅ Company found:`, {
          id: company.id,
          name: company.name,
          status: company.status,
          email: company.email,
        });

        await prisma.company.update({
          where: { id: company.id },
          data: {
            status: "ACTIVE",
            approvedAt: now,
          },
        });
        console.log(`[COMPANY_ACTIVATION] ✅ Company updated to ACTIVE`);

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
        console.log(`[COMPANY_ACTIVATION] ✅ Status history created`);

        break;
      }

  /**
 * Profile edit request approval (Merchant Profile Changes)
 */
case "PROFILE_EDIT_REQUEST":
case "PROFILE_CHANGE_APPROVAL": {
  console.log(`[PROFILE_EDIT_REQUEST] Starting profile edit approval...`);
  console.log(`[PROFILE_EDIT_REQUEST] Reference ID: ${queueItem.referenceId}`);
  console.log(`[PROFILE_EDIT_REQUEST] Meta:`, meta);

  const merchant = await prisma.merchant.findUnique({
    where: { id: queueItem.referenceId },
  });

  if (!merchant) {
    console.error(`[PROFILE_EDIT_REQUEST] ❌ Merchant not found: ${queueItem.referenceId}`);
    throw new Error(`Merchant not found: ${queueItem.referenceId}`);
  }

  console.log(`[PROFILE_EDIT_REQUEST] ✅ Merchant found:`, {
    id: merchant.id,
    businessName: merchant.businessName,
    status: merchant.status,
    logoUrl: merchant.logoUrl,
    categoryId: merchant.categoryId,
  });

  const requestedFields = meta.requestedFields || {};
  const originalValues = meta.originalValues || {};
  const approvalFields = meta.approvalFields || [];

  const ALLOWED_FIELDS = [
    'businessName',
    'categoryId',
    'logoUrl',
    'coverImageUrl',
    'description',
    'website',
    'contactName',
    'contactPhone',
    'socialLinks',
    'businessHours',
    'tags',
  ];

  const validFields = approvalFields.filter((field: string) =>
    ALLOWED_FIELDS.includes(field) && Object.keys(merchant).includes(field)
  );

  console.log(`[PROFILE_EDIT_REQUEST] Valid fields to update:`, validFields);

  // Build update data and simplified changes
  const updateData: Record<string, any> = {};
  const simplifiedChanges: Record<string, any> = {};

for (const field of validFields) {
  if (requestedFields[field] !== undefined) {
    const originalValue = originalValues[field] ?? (merchant as any)[field];
    const newValue = requestedFields[field];
    
    // Normalize values for comparison (handle null/undefined/empty string)
    const normalizedOriginal = originalValue || null;
    const normalizedNew = newValue || null;
    
    // Log for debugging
    console.log(`[PROFILE_EDIT_REQUEST] Field: ${field}`);
    console.log(`  Original: ${normalizedOriginal}`);
    console.log(`  New: ${normalizedNew}`);
    console.log(`  Equal: ${normalizedOriginal === normalizedNew}`);
    
    // Only store if actually changed
    if (normalizedOriginal !== normalizedNew) {
      updateData[field] = newValue;
      
      simplifiedChanges[field] = {
        from: originalValue ? 'changed' : 'null',
        to: newValue ? 'changed' : 'null',
        fieldType: typeof newValue,
      };
    }
  }
}

  if (Object.keys(updateData).length === 0) {
    console.warn(`[PROFILE_EDIT_REQUEST] ⚠️ No fields to update`);
    throw new Error('No fields to update');
  }

  console.log(`[PROFILE_EDIT_REQUEST] Update data:`, updateData);
  console.log(`[PROFILE_EDIT_REQUEST] Simplified changes:`, simplifiedChanges);

  // Update merchant
  await prisma.merchant.update({
    where: { id: merchant.id },
    data: updateData,
  });
  console.log(`[PROFILE_EDIT_REQUEST] ✅ Merchant updated`);

  // ✅ Store simplified changes as JSON string (small data)
  const changesJSON = JSON.stringify({
    fields: Object.keys(simplifiedChanges),
    changes: simplifiedChanges,
    reason: meta.reason || "Profile edit approved via action queue",
    timestamp: new Date().toISOString(),
  });

  console.log(`[PROFILE_EDIT_REQUEST] Changes JSON (length: ${changesJSON.length}):`, changesJSON);

  // Create status history with simplified changes
  await prisma.merchantStatusHistory.create({
    data: {
      merchantId: merchant.id,
      fromStatus: merchant.status,
      toStatus: merchant.status,
      changedBy: adminId,
      changedByType: "admin",
      reason: meta.reason || "Profile edit approved via action queue",
    },
  });
  console.log(`[PROFILE_EDIT_REQUEST] ✅ Status history created with simplified changes`);

  break;
}
      /**
       * Issue resolution
       */
      case "ISSUE_REVIEW": {
        const issueId = meta.issueId ?? queueItem.referenceId;

        console.log(`[ISSUE_REVIEW] Starting issue resolution...`);
        console.log(`[ISSUE_REVIEW] Issue ID: ${issueId}`);

        const issue = await prisma.issueReport.findUnique({
          where: { id: issueId },
        });

        if (!issue) {
          console.error(`[ISSUE_REVIEW] ❌ Issue not found: ${issueId}`);
          throw new Error(`Issue not found: ${issueId}`);
        }

        console.log(`[ISSUE_REVIEW] ✅ Issue found:`, {
          id: issue.id,
          status: issue.status,
          type: (issue as any)?.type,
        });

        await prisma.issueReport.update({
          where: { id: issueId },
          data: {
            status: "RESOLVED",
            resolvedAt: now,
            adminId,
          },
        });
        console.log(`[ISSUE_REVIEW] ✅ Issue resolved: ${issueId}`);

        break;
      }

      /**
       * Renewal alert
       */
      case "RENEWAL_ALERT": {
        const alertId = meta.alertId ?? queueItem.referenceId;

        console.log(`[RENEWAL_ALERT] Starting renewal alert dismissal...`);
        console.log(`[RENEWAL_ALERT] Alert ID: ${alertId}`);

        const alert = await prisma.renewalGamingAlert.findUnique({
          where: { id: alertId },
        });

        if (!alert) {
          console.error(`[RENEWAL_ALERT] ❌ Alert not found: ${alertId}`);
          throw new Error(`Alert not found: ${alertId}`);
        }

        console.log(`[RENEWAL_ALERT] ✅ Alert found:`, {
          id: alert.id,
          isDismissed: alert.isDismissed,
        });

        await prisma.renewalGamingAlert.update({
          where: { id: alertId },
          data: {
            isDismissed: true,
          },
        });
        console.log(`[RENEWAL_ALERT] ✅ Alert dismissed: ${alertId}`);

        break;
      }

      default: {
        console.error(
          `[UNSUPPORTED] ❌ Unsupported queue type: ${queueItem.type}`,
        );
        throw new Error(`Unsupported queue type: ${queueItem.type}`);
      }
    }

    console.log(`[ACTION] Updating queue item to COMPLETED...`);
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
    console.log(`[ACTION] ✅ Queue item updated to COMPLETED`);

    console.log(`[AUDIT] Creating audit log...`);
    await createAuditLog({
      actorType: "admin",
      actorId: adminId,
      action: "ACTION_QUEUE_APPROVED",
      entityType: "ACTION_QUEUE",
      entityId: queueItem.id,
      changes: {
        from: previousStatus,
        to: "COMPLETED",
        queueType: queueItem.type,
      } as any,
    });
    console.log(`[AUDIT] ✅ Audit log created`);

    console.log("========================================");
    console.log(`✅ APPROVE ACTION QUEUE - SUCCESS`);
    console.log(`Queue ${queueItem.id} completed successfully`);
    console.log("========================================");
  } catch (error) {
    console.error("========================================");
    console.error(`❌ APPROVE ACTION QUEUE - ERROR`);
    console.error("========================================");
    console.error(`[${new Date().toISOString()}] Error occurred`);
    console.error(`Queue ID: ${queueItem.id}`);
    console.error(`Queue Type: ${queueItem.type}`);
    console.error(`Reference ID: ${queueItem.referenceId}`);
    console.error(`Admin ID: ${adminId}`);
    console.error(`Error:`, error);
    console.error(
      `Error stack:`,
      error instanceof Error ? error.stack : "No stack trace",
    );
    console.error("========================================");
    throw error;
  }
}

async function performReject(
  queueItem: any,
  adminId: string,
  rejectionReason: string,
  now: Date,
) {
  const kind: EntityKind = getEntityKindFromReferenceType(
    queueItem.referenceType,
  ) as EntityKind;
  const meta = (queueItem.metadata as Record<string, unknown> | null) ?? {};
  const previousStatus = queueItem.status;

  if (kind === "MERCHANT_OFFER") {
    const offerId =
      (meta.offerId as string | undefined) ??
      (meta.newOfferId as string | undefined) ??
      queueItem.referenceId;
    const offer = await prisma.merchantOffer.findUnique({
      where: { id: offerId },
    });
    if (offer) {
      await prisma.merchantOffer.update({
        where: { id: offer.id },
        data: {
          status: "REJECTED",
          rejectionReason,
          reviewedAt: now,
          reviewedBy: adminId,
        },
      });
    }
  } else if (kind === "MERCHANT") {
    const merchant = await prisma.merchant.findUnique({
      where: { id: queueItem.referenceId },
    });
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
        ...((queueItem.metadata as any) ?? {}),
        rejectionReason,
        rejectedBy: adminId,
        rejectedAt: now.toISOString(),
      },
    },
  });

  await createAuditLog({
    actorType: "admin",
    actorId: adminId,
    action: "ACTION_QUEUE_REJECTED",
    entityType: "action_queue",
    entityId: queueItem.id,
    changes: {
      from: previousStatus,
      to: "FAILED",
      reason: rejectionReason,
      entityKind: kind,
    } as any,
  });
}

async function performRemark(queueItem: any, adminId: string, remark: string) {
  const existingMeta = (queueItem.metadata as any) ?? {};
  const remarks = Array.isArray(existingMeta.remarks)
    ? existingMeta.remarks
    : [];
  remarks.push({ text: remark, by: adminId, at: new Date().toISOString() });

  await prisma.actionQueueItem.update({
    where: { id: queueItem.id },
    data: { metadata: { ...existingMeta, remarks } as any },
  });

  await createAuditLog({
    actorType: "admin",
    actorId: adminId,
    action: "ACTION_QUEUE_REMARK_ADDED",
    entityType: "action_queue",
    entityId: queueItem.id,
    changes: { remark } as any,
  });
}

async function performEditAndApprove(
  queueItem: any,
  adminId: string,
  edits: Record<string, unknown>,
  now: Date,
) {
  const kind: EntityKind = getEntityKindFromReferenceType(
    queueItem.referenceType,
  ) as EntityKind;
  const meta = (queueItem.metadata as Record<string, unknown> | null) ?? {};

  if (kind === "MERCHANT_OFFER") {
    const offerId =
      (meta.offerId as string | undefined) ??
      (meta.newOfferId as string | undefined) ??
      queueItem.referenceId;
    const allowed = [
      "title",
      "description",
      "shortDescription",
      "termsAndConditions",
      "discountValue",
      "discountPercent",
      "minimumSpend",
      "maxRedemptions",
      "startDate",
      "endDate",
    ];
    const updateData: Record<string, unknown> = {};
    for (const key of allowed) {
      if (
        edits[key] !== undefined &&
        edits[key] !== null &&
        edits[key] !== ""
      ) {
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
      "businessName",
      "contactName",
      "contactPhone",
      "description",
      "email",
      "website",
      "city",
      "state",
      "addressLine1",
      "addressLine2",
      "postalCode",
    ];
    const updateData: Record<string, unknown> = {};
    for (const key of allowed) {
      if (
        edits[key] !== undefined &&
        edits[key] !== null &&
        edits[key] !== ""
      ) {
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

  await createAuditLog({
    actorType: "admin",
    actorId: adminId,
    action: "ACTION_QUEUE_EDITED",
    entityType: "action_queue",
    entityId: queueItem.id,
    changes: { edits, entityKind: kind } as any,
  });

  await performApprove(queueItem, adminId, now);
}
