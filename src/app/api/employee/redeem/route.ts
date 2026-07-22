import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// import { createAuditLog } from '@/services/audit-log.service'
import {
  getEmployeeFromSession,
  unauthorized,
  internalError,
  companyInactive,
  notFound,
  badRequest,
} from "@/lib/employee-session";
// import { checkRedemptionEligibility } from '@/lib/offer-visibility'
import {
  encodeMethod,
  deriveStatus,
  type RedemptionMethod,
} from "@/lib/redemption-status";

export async function GET(request: NextRequest) {
  try {
    const employee = await getEmployeeFromSession();
    if (!employee) return unauthorized();
    if ("inactive" in employee) return companyInactive(employee.companyStatus);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;

    const where: any = { employeeId: employee.id };
    if (status) {
      if (status === "PENDING") {
        where.isVerified = false;
        where.merchantNotes = { not: { startsWith: "REJECTED:" } };
        where.employeeNotes = { not: { startsWith: "CANCELLED:" } };
      } else if (status === "CONFIRMED") {
        where.isVerified = true;
      } else if (status === "REJECTED") {
        where.merchantNotes = { startsWith: "REJECTED:" };
      } else if (status === "CANCELLED") {
        where.employeeNotes = { startsWith: "CANCELLED:" };
      }
    }

    const rows = await prisma.redemption.findMany({
      where,
      orderBy: { redeemedAt: "desc" },
      take: 100,
      include: {
        offer: {
          select: {
            id: true,
            title: true,
            offerType: true,
            pricing: { select: { configuration: true } },
            redemption: {
              select: { redemptionType: true, configuration: true },
            },
          },
        },
        merchant: { select: { id: true, businessName: true, logoUrl: true } },
        company: { select: { id: true, name: true } },
      },
    });

    const branchIds = Array.from(
      new Set(rows.map((r) => r.branchId).filter((b): b is string => !!b)),
    );
    const branchList = branchIds.length
      ? await prisma.merchantBranch.findMany({
          where: { id: { in: branchIds } },
          select: { id: true, name: true, branchType: true },
        })
      : [];
    const branchMap = new Map(branchList.map((b) => [b.id, b]));

    const data = rows.map((r) => ({
      id: r.id,
      merchantId: r.merchantId,
      offerId: r.offerId,
      employeeId: r.employeeId,
      companyId: r.companyId,
      discountAmount: r.discountAmount,
      spentAmount: r.spentAmount,
      savingsAmount: r.savingsAmount,
      branchId: r.branchId,
      merchantNotes: r.merchantNotes,
      employeeNotes: r.employeeNotes,
      isVerified: r.isVerified,
      verifiedBy: r.verifiedBy,
      verifiedAt: r.verifiedAt,
      redeemedAt: r.redeemedAt,
      createdAt: r.createdAt,
      offer: r.offer,
      merchant: r.merchant,
      company: r.company,
      branch: r.branchId ? (branchMap.get(r.branchId) ?? null) : null,
      status: deriveStatus(r),
      method: ((): RedemptionMethod | null => {
        const m = r.merchantNotes?.match(/^METHOD:(\w+)/);
        return (m?.[1] as RedemptionMethod) ?? null;
      })(),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return internalError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const employee = await getEmployeeFromSession();
    if (!employee) return unauthorized();
    if ("inactive" in employee) return companyInactive(employee.companyStatus);
    const body = await request.json();
    const { offerId, branchId, notes, spentAmount } = body;

    if (!offerId) return badRequest("offerId is required");

    // const eligibility = await checkRedemptionEligibility(offerId, employee.id)
    // if (!eligibility.eligible) {
    //   return badRequest(eligibility.reason ?? 'Not eligible to redeem this offer')
    // }`
    await prisma.offerAnalytics.upsert({
      where: {
        offerId,
      },
      create: {
        offerId,
        clickCount: 1,
      },
      update: {
        clickCount: { increment: 1 },
      },
    });
    const offer = await prisma.merchantOffer.findFirst({
      where: { id: offerId, deletedAt: null },
      include: {
        merchant: { select: { id: true, businessName: true, website: true } },
        pricing: { select: { configuration: true } },
        redemption: { select: { redemptionType: true, configuration: true } },
      },
    });
    if (!offer) return notFound("Offer not found");

    const offerRedeem = await prisma.redemption.findFirst({
      where: { offerId, employeeId: employee.id },
    });
    if (offerRedeem) {
      return badRequest("You have already redeemed this offer");
    }

    const redemptionType = offer.redemption?.redemptionType ?? null;
    if (!redemptionType) {
      return badRequest(
        "This offer does not have a redemption type configured",
      );
    }

    const pricingConfig =
      (offer.pricing?.configuration as Record<string, unknown>) ?? {};
    const redemptionConfig =
      (offer.redemption?.configuration as Record<string, unknown>) ?? {};

    // Branch validation (required for IN_STORE_QR, optional for others)
    let validBranch: any = null;
    if (branchId) {
      const branch = await prisma.merchantBranch.findFirst({
        where: { id: branchId, merchantId: offer.merchantId, deletedAt: null },
      });
      if (!branch) return badRequest("Invalid branchId for this offer");
      validBranch = branch;
    }
    if (redemptionType === "IN_STORE_QR" && !validBranch) {
      return badRequest("Branch is required for in-store QR redemptions");
    }

    // Type-specific validation
    if (redemptionType === "ONLINE_CODE" && !redemptionConfig.code) {
      return badRequest("This offer does not have a valid offer code");
    }
    if (redemptionType === "BOOKING_LINK" && !redemptionConfig.bookingUrl) {
      return badRequest("This offer does not have a booking link");
    }

    const discountAmount = Number(
      pricingConfig.amount ?? pricingConfig.percent ?? 0,
    );
    const spent = spentAmount ? Number(spentAmount) : 0;
    const savings =
      redemptionType === "IN_STORE_QR"
        ? discountAmount
        : Math.max(0, discountAmount - spent);

    const status = redemptionType === "IN_STORE_QR" ? "PENDING" : "CONFIRMED";

    const method =
      redemptionType === "ONLINE_CODE"
        ? ("ONLINE" as const)
        : redemptionType === "BOOKING_LINK"
          ? ("ONLINE" as const)
          : ("IN_STORE" as const);

    // console.log('offer',offer,offer?.offerCode)
    const redemption = await prisma.redemption.create({
      data: {
        merchantId: offer.merchantId,
        offerId: offer.id,
        employeeId: employee.id,
        companyId: employee.companyId,
        redemptionCode:
          redemptionType === "ONLINE_CODE"
            ? String(redemptionConfig.code ?? "")
            : "OO000000", // Placeholder code for in-store redemptions
        discountAmount,
        spentAmount: spent || null,
        savingsAmount: savings,
        branchId: validBranch?.id ?? null,
        merchantNotes: encodeMethod(method),
        employeeNotes: notes ?? null,
        isVerified: status === "CONFIRMED",
        verifiedAt: status === "CONFIRMED" ? new Date() : null,
        redeemedAt: new Date(),
      },
    });

    await prisma.offerRedemption.update({
      where: { offerId },
      data: { currentRedemptions: { increment: 1 } },
    });

    // await createAuditLog({
    //   actorType: 'employee',
    //   actorId: employee.id,
    //   action: `REDEMPTION_CREATED_${redemptionType}`,
    //   entityType: 'redemption',
    //   entityId: redemption.id,
    //   metadata: {
    //     offerId,
    //     merchantId: offer.merchantId,
    //     method,
    //     branchId: validBranch?.id ?? null,
    //     redemptionType,
    //     offerCode: redemptionType === 'ONLINE_CODE' ? offer.offerCode : null,
    //   },
    // })

    // Build type-specific response data
    const data: Record<string, unknown> = {
      id: redemption.id,
      type: redemptionType,
      status,
    };

    if (redemptionType === "IN_STORE_QR" && validBranch) {
      const lat = validBranch.latitude ? Number(validBranch.latitude) : null;
      const lng = validBranch.longitude ? Number(validBranch.longitude) : null;
      data.merchant = {
        businessName: offer.merchant.businessName,
        website: offer.merchant.website,
      };
      data.branch = {
        name: validBranch.name,
        addressLine1: validBranch.addressLine1,
        addressLine2: validBranch.addressLine2,
        city: validBranch.city,
        state: validBranch.state,
        postalCode: validBranch.postalCode,
        phone: validBranch.phone,
        latitude: lat,
        longitude: lng,
        openingHours: validBranch.openingHours,
        googleMapsUrl:
          lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null,
      };
      data.instructions = redemptionConfig.instructions ?? null;
    }

    if (redemptionType === "ONLINE_CODE") {
      data.offerCode = redemptionConfig.code ?? null;
      data.merchantWebsite = redemptionConfig.bookingUrl ?? null;
      data.instructions = redemptionConfig.instructions ?? null;
    }

    if (redemptionType === "BOOKING_LINK") {
      data.bookingUrl = redemptionConfig.bookingUrl ?? null;
      data.instructions = redemptionConfig.instructions ?? null;
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return internalError(error);
  }
}
