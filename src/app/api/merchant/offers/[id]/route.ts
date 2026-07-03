import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";
import { generateUniqueOfferCode } from '@/lib/offer-code';
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
];

function unauthorized() {
  return NextResponse.json(
    {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized" },
    },
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

function badRequest(message: string) {
  return NextResponse.json(
    { success: false, error: { code: "VALIDATION", message } },
    { status: 400 },
  );
}

function internalError(error: unknown) {
  console.error("Merchant offer error:", error);
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
  const account = await prisma.account.findUnique({ where: { email: user.email }, select: { authUserId: true } });
  if (!account) return null;
  return prisma.merchant.findFirst({ where: { accountId: account.authUserId } });
}

async function getOwnOffer(merchantId: string, offerId: string) {
  return prisma.merchantOffer.findFirst({
    where: { id: offerId, merchantId },
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

    if (!EDITABLE_STATUSES.includes(existing.status)) {
      return forbidden("Only draft or validation-failed offers can be edited");
    }

    const body = await request.json();
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
      "qrCodeUrl",
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
    }

    // Handle redemptionType changes
    if (body.redemptionType !== undefined) {
      if (body.redemptionType && !VALID_REDEMPTION_TYPES.includes(body.redemptionType)) {
        return badRequest(
          `Invalid redemptionType. Must be one of: ${VALID_REDEMPTION_TYPES.join(', ')}`,
        );
      }
      updatable.redemptionType = body.redemptionType ?? null;

      // Auto-generate offerCode when switching to ONLINE_CODE
      if (body.redemptionType === 'ONLINE_CODE' && !existing.offerCode) {
        updatable.offerCode = await generateUniqueOfferCode();
        
        // Audit log for offer code generation
        await createAuditLog({
          actorType: 'merchant',
          actorId: merchant.id,
          action: "OFFER_CODE_GENERATED",
          entityType: "MERCHANT_OFFER",
          entityId: existing.id,
          metadata: {
            offerCode: updatable.offerCode,
            redemptionType: body.redemptionType,
          },
        });
      }
    }

    // Allow merchant to regenerate offerCode for ONLINE_CODE
    if (body.regenerateOfferCode && existing.redemptionType === 'ONLINE_CODE') {
      updatable.offerCode = await generateUniqueOfferCode();
      
      await createAuditLog({
        actorType: 'merchant',
        actorId: merchant.id,
        action: "OFFER_CODE_REGENERATED",
        entityType: "MERCHANT_OFFER",
        entityId: existing.id,
        metadata: {
          oldCode: existing.offerCode,
          newCode: updatable.offerCode,
        },
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

// export async function DELETE(
//   _request: NextRequest,
//   { params }: { params: Promise<{ id: string }> },
// ) {
//   try {
//     const merchant = await getMerchantFromUser();
//     if (!merchant) return unauthorized();
//     const { id } = await params;
//     const existing = await getOwnOffer(merchant.id, id);
//     if (!existing) return notFound();

//     console.log('** Attempting to delete offer with ID:', id, 'Current status:', existing.status);

//     if (!DELETABLE_STATUSES.includes(existing.status)) {
//       return forbidden(
//         "Only draft, validation-failed, rejected, expired, replaced, or awaiting-approval offers can be deleted",
//       );
//     }
  
//   if(existing.status != "LIVE") {
//     await prisma.merchantOffer.update({
//       where: { id },
//       data: { status: "ARCHIVED" },
//     });

//   }
//    await prisma.merchantOffer.delete({
//       where: { id },
//     });  
  
//     await prisma.auditLog.create({
//       data: {
//         actorType: "MERCHANT",
//         merchantId: merchant.id,
//         action: "OFFER_DELETED",
//         entityType: "MERCHANT_OFFER",
//         entityId: id,
//         metadata: { title: existing.title, previousStatus: existing.status },
//       },
//     });

//     return NextResponse.json({ success: true });
//   } catch (error) {
//     return internalError(error);
//   }
// }
