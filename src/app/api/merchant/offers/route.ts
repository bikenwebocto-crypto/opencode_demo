import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";
import { Prisma, OfferStatus } from "@prisma/client";
import {
  ReplacementValidationError,
  validateReplacement,
} from "@/lib/offer-replacement";
import { logReplacementAudit, notifyReplacement } from "@/lib/offer-replacement-notifications";
const MIN_TITLE_LENGTH = 5;
const MAX_TITLE_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_SHORT_DESCRIPTION_LENGTH = 500;
const ALLOWED_IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp"];

function unauthorized() {
  return NextResponse.json(
    {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized" },
    },
    { status: 401 },
  );
}

function badRequest(message: string) {
  return NextResponse.json(
    { success: false, error: { code: "VALIDATION", message } },
    { status: 400 },
  );
}

function internalError(error: unknown) {
  console.error("Merchant offers error:", error);
  return NextResponse.json(
    {
      success: false,
      error: { code: "INTERNAL", message: "Internal server error" },
    },
    { status: 500 },
  );
}

async function getMerchantFromUser() {
  const user = await getCurrentUser();
  if (!user || user.userType !== "merchant") return null;
  return prisma.merchant.findUnique({ where: { email: user.email } });
}

function runQualityChecks(body: any): {
  passed: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!body.title || body.title.trim().length < MIN_TITLE_LENGTH) {
    errors.title = `Title must be at least ${MIN_TITLE_LENGTH} characters`;
  }
  if (body.title && body.title.length > MAX_TITLE_LENGTH) {
    errors.title = `Title must be at most ${MAX_TITLE_LENGTH} characters`;
  }
  if (body.description && body.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`;
  }
  if (
    body.shortDescription &&
    body.shortDescription.length > MAX_SHORT_DESCRIPTION_LENGTH
  ) {
    errors.shortDescription = `Short description must be at most ${MAX_SHORT_DESCRIPTION_LENGTH} characters`;
  }
  if (!body.offerType) errors.offerType = "Offer type is required";
  if (body.discountValue == null || Number(body.discountValue) <= 0) {
    errors.discountValue = "Discount value must be a positive number";
  }
  if (!body.startDate) errors.startDate = "Start date is required";
  if (!body.endDate) errors.endDate = "End date is required";
  if (
    body.startDate &&
    body.endDate &&
    new Date(body.endDate) <= new Date(body.startDate)
  ) {
    errors.endDate = "End date must be after start date";
  }
  if (!body.termsAndConditions) {
    errors.termsAndConditions = "Terms and conditions are required";
  }
  if (!body.categoryId) {
    errors.categoryId = "Category is required";
  }
  if (body.imageUrls && Array.isArray(body.imageUrls)) {
    for (const url of body.imageUrls) {
      if (typeof url === "string" && url.trim()) {
        const ext = url.split(".").pop()?.toLowerCase();
        if (!ext || !ALLOWED_IMAGE_FORMATS.includes(ext)) {
          errors.imageUrls = `Image format not supported. Allowed: ${ALLOWED_IMAGE_FORMATS.join(", ")}`;
          break;
        }
      }
    }
  }

  return { passed: Object.keys(errors).length === 0, errors };
}

async function checkDuplicateOffer(
  merchantId: string,
  title: string,
  excludeId?: string,
): Promise<boolean> {
  const existing = await prisma.merchantOffer.findFirst({
    where: {
      merchantId,
      title: { equals: title, mode: "insensitive" },
      status: {
        in: [
          OfferStatus.LIVE,
          OfferStatus.AWAITING_APPROVAL,
          OfferStatus.VALIDATION_IN_PROGRESS,
        ],
      },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  return !!existing;
}

export async function GET(request: NextRequest) {
  try {
    const merchant = await getMerchantFromUser();
    // console.log("** Merchant offers GET - merchant running ");
    if (!merchant) return unauthorized();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") ?? "10")),
    );
    const status = searchParams.get("status");
    const q = searchParams.get("q");
    const scope = searchParams.get("scope"); // 'live', 'history', 'drafts'

    const where: any = { merchantId: merchant.id };
    if (status) where.status = status;
    if (q)
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    if (scope === "history") {
      where.status = { in: ["REPLACED", "EXPIRED", "ARCHIVED"] };
    } else if (scope === "drafts") {
      where.status = { in: ["DRAFT", "VALIDATION_FAILED"] };
    } else if (scope === "archived") {
      where.status = "ARCHIVED";
    }

    const [offers, total] = await Promise.all([
      prisma.merchantOffer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { redemptions: true } },
          replacesOffer: { select: { id: true, title: true } },
        },
      }),
      prisma.merchantOffer.count({ where }),
    ]);

    // Get current live offer separately
    const currentLive = await prisma.merchantOffer.findFirst({
      where: { merchantId: merchant.id, status: "LIVE" },
      include: {
        _count: { select: { redemptions: true } },
        replacementReqAsNew: {
          where: { status: { in: ["PENDING", "AWAITING_APPROVAL"] } },
          include: { newOffer: true },
        },
      },
    });

    // Get pending replacement (if any). CHANGES_REQUESTED counts as
    // "still in flight" — merchant must edit+resubmit or delete before
    // a fresh replacement can be created.
    const pendingReplacement = currentLive
      ? await prisma.merchantOffer.findFirst({
          where: {
            merchantId: merchant.id,
            replacesOfferId: currentLive.id,
            status: {
              in: [
                "VALIDATION_IN_PROGRESS",
                "AWAITING_APPROVAL",
                "VALIDATION_FAILED",
                "CHANGES_REQUESTED",
              ],
            },
          },
        })
      : null;

    // The replacement-request row carries the status (AWAITING_APPROVAL /
    // CLARIFICATION_REQUESTED) — surface it so the merchant UI can show
    // the right copy.
    const pendingReplacementRequest = pendingReplacement
      ? await prisma.offerReplacementRequest.findFirst({
          where: { newOfferId: pendingReplacement.id },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    return NextResponse.json({
      success: true,
      data: offers,
      currentLive,
      pendingReplacement,
      pendingReplacementRequest,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return internalError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const merchant = await getMerchantFromUser();
    console.log("** Merchant offers POST - merchant:");
    if (!merchant) return unauthorized();

    const body = await request.json();
    const {
      title,
      description,
      shortDescription,
      termsAndConditions,
      imageUrls,
      offerType,
      discountValue,
      discountMax,
      discountPercent,
      minimumSpend,
      maxRedemptions,
      startDate,
      endDate,
      daysOfWeek,
      redemptionCode,
      redemptionInstructions,
      categoryId,
      submissionNotes,
      replacesOfferId,
      replacementReason,
      saveAsDraft,
    } = body;

    if (
      !title ||
      !offerType ||
      discountValue == null ||
      !startDate ||
      !endDate
    ) {
      return badRequest(
        "Missing required fields: title, offerType, discountValue, startDate, endDate",
      );
    }

    // Validate category
    if (categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
      });
      console.log('** Validating categoryId:', categoryId, 'Found category:', !!category);
      if (!category) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_CATEGORY",
              message: "Selected category does not exist.",
            },
          },
          { status: 400 },
        );
      }
    }

    // Check duplicate
    const isDuplicate = await checkDuplicateOffer(merchant.id, title);
    if (isDuplicate) {
      return badRequest(
        "An offer with this title already exists (live, awaiting approval, or in review)",
      );
    }

    // Replacement validation: only LIVE offers can be replaced,
    // no chains, no concurrent pending replacements.
    if (replacesOfferId) {
      try {
        await validateReplacement(prisma, {
          merchantId: merchant.id,
          targetOfferId: replacesOfferId,
        })
      } catch (err) {
        if (err instanceof ReplacementValidationError) {
          return NextResponse.json(
            {
              success: false,
              error: { code: err.code, message: err.message },
            },
            { status: 400 },
          )
        }
        throw err
      }
    }

    // Only one pending draft per merchant (Phase 5)
    if (saveAsDraft) {
      const existingDraft = await prisma.merchantOffer.findFirst({
        where: {
          merchantId: merchant.id,
          status: { in: ['DRAFT', 'VALIDATION_FAILED', 'CHANGES_REQUESTED'] },
          id: { not: body.excludeId ?? '' },
        },
      });
      if (existingDraft) {
        return badRequest('You already have a pending draft. Please submit or delete it before creating a new one.');
      }
    }

    // Run quality checks for ALL submitted offers (not just replacements)
    let qcResult = { passed: true, errors: {} as Record<string, string> };
    if (!saveAsDraft) {
      qcResult = runQualityChecks(body);
    }

    // After validation, offers go to AWAITING_APPROVAL or VALIDATION_FAILED
    // VALIDATION_IN_PROGRESS is only for transient background processing
    console.log('** Quality check result:', qcResult);
    const targetStatus = saveAsDraft
      ? "DRAFT"
      : qcResult.passed
        ? "AWAITING_APPROVAL"
        : "VALIDATION_FAILED";

    const offer = await prisma.merchantOffer.create({
      data: {
        merchantId: merchant.id,
        title,
        description: description ?? "",
        shortDescription: shortDescription ?? null,
        termsAndConditions: termsAndConditions ?? null,
        imageUrls: imageUrls ?? [],
        offerType,
        discountValue,
        discountMax: discountMax ?? null,
        discountPercent: discountPercent ?? null,
        minimumSpend: minimumSpend ?? null,
        maxRedemptions: maxRedemptions ?? null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        daysOfWeek: daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6],
        redemptionCode: redemptionCode ?? null,
        redemptionInstructions: redemptionInstructions ?? null,
        categoryId: categoryId ?? null,
        replacesOfferId: replacesOfferId ?? null,
        submissionNotes: submissionNotes ?? null,
        isReplacement: !!replacesOfferId,
        replacementReason: body.replacementReason ?? null,
        validationErrors: qcResult.passed
          ? Prisma.DbNull
          : (qcResult.errors as any),
        status: targetStatus,
        submittedAt: saveAsDraft ? null : new Date(),
      },
    });
    console.log('** Created offer with ID:', offer.id, 'Status:', offer.status);
    // Post-creation actions for passing offers
    if (!saveAsDraft && qcResult.passed) {
      if (replacesOfferId) {
        // Replacement: create replacement request + action queue item
        await prisma.offerReplacementRequest.create({
          data: {
            currentOfferId: replacesOfferId,
            newOfferId: offer.id,
            status: "AWAITING_APPROVAL",
            reason: body.replacementReason ?? null,
          },
        });

        await prisma.actionQueueItem.create({
          data: {
            type: "OFFER_REPLACEMENT",
            title: `Offer Replacement: ${title}`,
            description: `Merchant ${merchant.businessName} submitted a replacement offer`,
            referenceId: merchant.id,
            referenceType: "MERCHANT",
            status: "PENDING",
            priority: 1,
            metadata: {
              currentOfferId: replacesOfferId,
              newOfferId: offer.id,
              reason: body.replacementReason ?? null,
            },
          },
        });

        // Audit + notifications
        await logReplacementAudit({
          event: 'OFFER_REPLACEMENT_CREATED',
          merchantId: merchant.id,
          newOfferId: offer.id,
          currentOfferId: replacesOfferId,
          reason: body.replacementReason,
        })
        await notifyReplacement({
          event: 'SUBMITTED',
          merchantId: merchant.id,
          newOfferId: offer.id,
          currentOfferId: replacesOfferId,
        }).catch((err) => console.error('Replacement submit notify failed', err))
        await notifyReplacement({
          event: 'ADMIN_PENDING',
          merchantId: merchant.id,
          newOfferId: offer.id,
          currentOfferId: replacesOfferId,
        }).catch((err) => console.error('Replacement admin notify failed', err))
      } else {
        // Prevent duplicate queue items
        const existingItems = await prisma.actionQueueItem.findMany({
          where: { referenceId: merchant.id, type: 'OFFER_APPROVAL', status: 'PENDING' },
        });
        const hasExisting = existingItems.some((i) => {
          const meta = i.metadata as Record<string, unknown> | null;
          return meta?.offerId === offer.id;
        });
        if (!hasExisting) {
          await prisma.actionQueueItem.create({
            data: {
              type: "OFFER_APPROVAL",
              title: `Offer Approval: ${title}`,
              description: `Merchant ${merchant.businessName} submitted an offer for approval`,
              referenceId: merchant.id,
              referenceType: "MERCHANT",
              status: "PENDING",
              priority: 1,
              metadata: {
                offerId: offer.id,
              },
            },
          });
        }
      }
      console.log('** Created action queue item for offer approval/replacement',);
      // Audit log
      await prisma.auditLog.create({
        data: {
          actorType: "MERCHANT",
          merchantId: merchant.id,
          action: "OFFER_SUBMITTED_FOR_APPROVAL",
          entityType: "MERCHANT_OFFER",
          entityId: offer.id,
          metadata: {
            title,
            replacesOfferId: replacesOfferId ?? null,
          },
        },
      });
    }
    console.log('** Created offer with ID:', offer.id, 'Status:', offer.status);
    return NextResponse.json(
      {
        success: true,
        data: offer,
        qualityCheck: qcResult.passed ? "PASSED" : "FAILED",
        validationErrors: qcResult.errors,
      },
      { status: 201 },
    );
  } catch (error) {
    return internalError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const merchant = await getMerchantFromUser();
    if (!merchant) return unauthorized();

    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids');
    if (!ids) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Offer IDs are required' } },
        { status: 400 },
      );
    }

    const idList = ids.split(',').filter(Boolean);
    if (idList.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'At least one offer ID is required' } },
        { status: 400 },
      );
    }

    const deletableStatuses = ['DRAFT', 'VALIDATION_FAILED', 'REJECTED', 'EXPIRED', 'REPLACED', 'AWAITING_APPROVAL','ARCHIVED'];

    const offers = await prisma.merchantOffer.findMany({
      where: { id: { in: idList }, merchantId: merchant.id },
    });

    const invalid = offers.filter((o) => !deletableStatuses.includes(o.status));
    if (invalid.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Cannot delete ${invalid.length} offer(s) — live offers must be replaced instead`,
          },
        },
        { status: 403 },
      );
    }

    // If any of the offers are LIVE, archive those live offers first
    if (offers.some((o) => o.status === 'LIVE')) {
      await prisma.merchantOffer.updateMany({
        where: { id: { in: idList }, merchantId: merchant.id, status: 'LIVE' },
        data: { status: 'ARCHIVED' },
      });
    }

    await prisma.merchantOffer.deleteMany({
      where: { id: { in: idList }, merchantId: merchant.id },
    });

    for (const offer of offers) {
      await prisma.auditLog.create({
        data: {
          actorType: 'MERCHANT',
          merchantId: merchant.id,
          action: 'OFFER_DELETED',
          entityType: 'MERCHANT_OFFER',
          entityId: offer.id,
          metadata: { title: offer.title, previousStatus: offer.status },
        },
      });
    }

    return NextResponse.json({ success: true, deleted: offers.length });
  } catch (error) {
    return internalError(error);
  }
}
