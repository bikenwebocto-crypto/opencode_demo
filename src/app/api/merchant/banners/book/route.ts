import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";
import { getMerchantFromSession } from "@/lib/merchant-session";

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
    { status: 401 },
  );
}

function notFound() {
  return NextResponse.json(
    { success: false, error: { code: "NOT_FOUND", message: "Merchant not found" } },
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
  console.error("Merchant book banner API error:", error);
  return NextResponse.json(
    { success: false, error: { code: "INTERNAL", message: "Internal server error" } },
    { status: 500 },
  );
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== "merchant") return unauthorized();
    const merchant = await getMerchantFromSession();
    if (!merchant) return notFound();

    const body = await request.json();
    const { bannerId, startDate, endDate, imageUrl, altText, redirectUrl } = body;

    if (!bannerId || !startDate || !endDate || !imageUrl) {
      return badRequest("bannerId, startDate, endDate, and imageUrl are required");
    }

    const banner = await prisma.banner.findUnique({ where: { id: bannerId } });
    if (!banner) return badRequest("Banner slot not found");
    if (!banner.isActive) return badRequest("Banner slot is not active");

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return badRequest("Invalid date format");
    }

    if (start >= end) return badRequest("End date must be after start date");

    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (days < banner.minDays) return badRequest(`Minimum booking period is ${banner.minDays} days`);
    if (days > banner.maxDays) return badRequest(`Maximum booking period is ${banner.maxDays} days`);

    if (banner.expiresAt && end > banner.expiresAt) {
      return badRequest(
        `Booking cannot extend beyond banner expiry (${banner.expiresAt.toLocaleDateString()})`,
      );
    }

    const totalPrice = Number(banner.pricePerDay) * days;

    const result = await prisma.$transaction(async (tx) => {
      // Find every slotNumber currently held by an active (PENDING or
      // APPROVED) booking whose date range overlaps the requested window.
      const conflicting = await tx.bannerBooking.findMany({
        where: {
          bannerId,
          status: { in: ["PENDING", "APPROVED"] },
          startDate: { lt: end },
          endDate: { gt: start },
        },
        select: { slotNumber: true },
      });

      const takenSlots = new Set(conflicting.map((b) => b.slotNumber));

      let assignedSlot: number | null = null;
      for (let i = 1; i <= banner.slotCount; i++) {
        if (!takenSlots.has(i)) {
          assignedSlot = i;
          break;
        }
      }

      if (assignedSlot === null) {
        throw new Error(
          `All ${banner.slotCount} slots for ${banner.position} are booked for the requested dates. Please choose different dates or check back later.`,
        );
      }

      const booking = await tx.bannerBooking.create({
        data: {
          bannerId,
          merchantId: merchant.id,
          slotNumber: assignedSlot,
          startDate: start,
          endDate: end,
          totalPrice,
          status: "PENDING",
        },
      });

      await tx.bannerContent.create({
        data: {
          bookingId: booking.id,
          imageUrl,
          altText,
          redirectUrl,
        },
      });

      return tx.bannerBooking.findUnique({
        where: { id: booking.id },
        include: {
          banner: { select: { id: true, name: true, position: true } },
          content: true,
        },
      });
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("slots for")) {
      return badRequest(error.message);
    }
    return internalError(error);
  }
}