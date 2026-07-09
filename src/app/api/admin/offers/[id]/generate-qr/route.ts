import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";
import { ensureOfferQRCode } from "@/lib/offer-qr";

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
  console.error("Admin QR generation error:", error);
  return NextResponse.json(
    { success: false, error: { code: "INTERNAL", message: "Internal server error" } },
    { status: 500 },
  );
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== "admin") return unauthorized();

    const { id } = await params;

    const offer = await prisma.merchantOffer.findFirst({
      where: { id, deletedAt: null },
    });

    if (!offer) return notFound();

    if (offer.redemptionType !== 'IN_STORE_QR') {
      return badRequest(`Offer redemption type is "${offer.redemptionType}", not IN_STORE_QR. QR codes are only generated for IN_STORE_QR offers.`);
    }

    console.log('[ADMIN GENERATE QR] Admin', user.email, 'requested QR regeneration for offer:', id);

    const result = await ensureOfferQRCode(id);

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "GENERATION_FAILED",
            message: "QR code generation failed. Check server logs for details.",
          },
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        qrCodeUrl: result.qrUrl,
        qrToken: result.qrToken,
      },
    });
  } catch (error) {
    return internalError(error);
  }
}
