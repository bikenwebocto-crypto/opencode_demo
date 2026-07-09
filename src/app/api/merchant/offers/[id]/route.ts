import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";
import { generateUniqueOfferCode } from '@/lib/offer-code';
import { ensureOfferQRCode } from '@/lib/offer-qr';

import { createAuditLog } from '@/services/audit-log.service';

const EDITABLE_STATUSES = ["DRAFT", "VALIDATION_FAILED", "AWAITING_APPROVAL"];
const VALID_REDEMPTION_TYPES = ['ONLINE_CODE', 'BOOKING_LINK', 'IN_STORE_QR'] as const;
const DELETABLE_STATUSES = [
  "DRAFT",
  "VALIDATION_FAILED",
  "REJECTED",
  "EXPIRED",
  "REPLACED",
  "AWAITING_APPROVAL",
  "ARCHIVED",
];

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
    { status: 401 },
  );
}

function notFound(msg = "Offer not found") {
  return NextResponse.json(
    { success: false, error: { code: "NOT_FOUND", message: msg } },
    { status: 404 },
  );
}

function forbidden(msg: string) {
  return NextResponse.json(
    { success: false, error: { code: "FORBIDDEN", message: msg } },
    { status: 403 },
  );
}

function conflict(msg: string) {
  return NextResponse.json(
    { success: false, error: { code: "CONFLICT", message: msg } },
    { status: 409 },
  );
}

function badRequest(message: string) {
  return NextResponse.json(
    { success: false, error: { code: "VALIDATION", message } },
    { status: 400 },
  );
}

function internalError(error: unknown) {
  console.error("Merchant offer error:", error);
  return NextResponse.json(
    { success: false, error: { code: "INTERNAL", message: "Internal server error" } },
    { status: 500 },
  );
}

async function getMerchantFromUser() {
  const user = await getCurrentUser();
  if (!user || user.userType !== "merchant") return null;
  const account = await prisma.account.findUnique({ where: { email: user.email }, select: { authUserId: true } });
  if (!account) return null;
  return prisma.merchant.findFirst({ where: { accountId: account.authUserId } });
}

async function getOwnOffer(merchantId: string, offerId: string) {
  return prisma.merchantOffer.findFirst({
    where: { id: offerId, merchantId, deletedAt: null },
    include: { _count: { select: { redemptions: true } } },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const merchant = await getMerchantFromUser();
    if (!merchant) return unauthorized();
    const { id } = await params;
    const offer = await getOwnOffer(merchant.id, id);
    if (!offer) return notFound();

    // Recovery: if LIVE IN_STORE_QR offer has no QR, generate one silently
    if (offer.status === 'LIVE' && offer.redemptionType === 'IN_STORE_QR' && !offer.qrCodeUrl) {
      console.log('[MERCHANT OFFERS GET] Recovery triggered — LIVE IN_STORE_QR offer missing QR code. Generating...');
      ensureOfferQRCode(offer.id).then((result) => {
        if (result) {
          console.log('[MERCHANT OFFERS GET] Recovery QR generated successfully:', result.qrUrl);
        } else {
          console.log('[MERCHANT OFFERS GET] Recovery QR generation returned null');
        }
      });
    }

    return NextResponse.json({ success: true, data: offer });
  } catch (error) {
    return internalError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const merchant = await getMerchantFromUser();
    if (!merchant) return unauthorized();
    const { id } = await params;
    const existing = await getOwnOffer(merchant.id, id);
    if (!existing) return notFound();

    console.log('[MERCHANT OFFERS PATCH] Start - offer id:', id);
    console.log('[MERCHANT OFFERS PATCH] Existing offer:', {
      id: existing.id,
      status: existing.status,
      redemptionType: existing.redemptionType,
      hasQrCodeUrl: !!existing.qrCodeUrl,
    });

    if (!EDITABLE_STATUSES.includes(existing.status)) {
      console.log('[MERCHANT OFFERS PATCH] ❌ Not editable, status:', existing.status);
      return forbidden("Only draft or validation-failed offers can be edited");
    }

    const body = await request.json();
    console.log('[MERCHANT OFFERS PATCH] Incoming body keys:', Object.keys(body));
    console.log('[MERCHANT OFFERS PATCH] redemptionType:', body.redemptionType);

    const updatable: any = {};
    const fields = [
      "title",
      "description",
      "shortDescription",
      "termsAndConditions",
      "imageUrls",
      "offerType",
      "discountValue",
      "discountMax",
      "discountPercent",
      "minimumSpend",
      "maxRedemptions",
      "daysOfWeek",
      "redemptionCode",
      "redemptionInstructions",
      "categoryId",
      "submissionNotes",
      "bookingUrl",
    ];
    for (const f of fields) {
      if (body[f] !== undefined) updatable[f] = body[f];
    }
    if (body.startDate) updatable.startDate = new Date(body.startDate);
    if (body.endDate) updatable.endDate = new Date(body.endDate);

    // Validate daysOfWeek if provided
    if (body.daysOfWeek !== undefined && body.daysOfWeek !== null) {
      if (!Array.isArray(body.daysOfWeek)) {
        return badRequest("daysOfWeek must be an array of integers 0-6");
      }
      if (body.daysOfWeek.length === 0) {
        return badRequest("Select at least one valid day");
      }
      if (body.daysOfWeek.some((d: unknown) => typeof d !== 'number' || d < 0 || d > 6 || !Number.isInteger(d))) {
        return badRequest("Each day must be an integer between 0 and 6");
      }
      updatable.daysOfWeek = body.daysOfWeek;
    }

    // Validate redemptionType if provided
    if (body.redemptionType && !VALID_REDEMPTION_TYPES.includes(body.redemptionType)) {
      return badRequest(`Invalid redemption type: ${body.redemptionType}`);
    }

    // If redemption type was changed to ONLINE_CODE, auto-generate code
    if (body.redemptionType === 'ONLINE_CODE' && existing.redemptionType !== 'ONLINE_CODE' && !existing.offerCode) {
      updatable.offerCode = await generateUniqueOfferCode();
      await createAuditLog({
        actorType: 'merchant',
        merchantId: merchant.id,
        action: "OFFER_CODE_GENERATED",
        entityType: "MERCHANT_OFFER",
        entityId: id,
        metadata: { offerCode: updatable.offerCode, redemptionType: 'ONLINE_CODE' },
      });
    }

    // Allow merchant to regenerate offer code
    if (body.regenerateOfferCode) {
      updatable.offerCode = await generateUniqueOfferCode();
      await createAuditLog({
        actorType: 'merchant',
        merchantId: merchant.id,
        action: "OFFER_CODE_REGENERATED",
        entityType: "MERCHANT_OFFER",
        entityId: id,
        metadata: { offerCode: updatable.offerCode },
      });
    }

    const offer = await prisma.merchantOffer.update({
      where: { id },
      data: updatable,
    });

    return NextResponse.json({ success: true, data: offer });
  } catch (error) {
    return internalError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const merchant = await getMerchantFromUser();
    if (!merchant) return unauthorized();
    const { id } = await params;
    const existing = await getOwnOffer(merchant.id, id);
    if (!existing) return notFound();

    if (!DELETABLE_STATUSES.includes(existing.status)) {
      return forbidden(
        "Only draft, validation-failed, rejected, expired, replaced, awaiting-approval, or archived offers can be deleted",
      );
    }

    // Soft delete — set deletedAt, keep all data and storage assets intact
    await prisma.merchantOffer.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById: merchant.id,
        deletedByRole: 'merchant',
      },
    });

    await createAuditLog({
      actorType: 'merchant',
      actorId: merchant.id,
      action: "OFFER_DELETED",
      entityType: "MERCHANT_OFFER",
      entityId: id,
      metadata: { title: existing.title, previousStatus: existing.status },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError(error);
  }
}
