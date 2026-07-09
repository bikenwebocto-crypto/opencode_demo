import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAuditLog } from '@/services/audit-log.service';

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

function badRequest(message: string) {
  return NextResponse.json(
    { success: false, error: { code: "VALIDATION", message } },
    { status: 400 },
  );
}

function internalError(error: unknown) {
  console.error("Merchant offer revoke error:", error);
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const merchant = await getMerchantFromUser();
    if (!merchant) return unauthorized();

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    if (!reason?.trim()) {
      return badRequest("Revocation reason is required");
    }

    const offer = await prisma.merchantOffer.findFirst({
      where: { id, merchantId: merchant.id, deletedAt: null },
    });

    if (!offer) return notFound();

    if (offer.status !== "LIVE") {
      return badRequest("Only live offers can be revoked");
    }

    await prisma.merchantOffer.update({
      where: { id },
      data: {
        status: "ARCHIVED",
        reviewedAt: new Date(),
        reviewNotes: reason.trim(),
      },
    });

    await createAuditLog({
      actorType: 'merchant',
      merchantId: merchant.id,
      action: "OFFER_REVOKED",
      entityType: "MERCHANT_OFFER",
      entityId: id,
      metadata: { title: offer.title, reason: reason.trim(), previousStatus: offer.status },
    });

    return NextResponse.json({
      success: true,
      message: "Offer revoked successfully",
    });
  } catch (error) {
    return internalError(error);
  }
}
