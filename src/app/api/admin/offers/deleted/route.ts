import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
    { status: 401 },
  );
}

function internalError(error: unknown) {
  console.error("Admin deleted offers error:", error);
  return NextResponse.json(
    { success: false, error: { code: "INTERNAL", message: "Internal server error" } },
    { status: 500 },
  );
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== "admin") return unauthorized();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));
    const q = searchParams.get("q") ?? undefined;
    const merchantId = searchParams.get("merchantId") ?? undefined;

    const where: any = { deletedAt: { not: null } };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { merchant: { businessName: { contains: q, mode: "insensitive" } } },
      ];
    }
    if (merchantId) where.merchantId = merchantId;

    const [offers, total] = await Promise.all([
      prisma.merchantOffer.findMany({
        where,
        orderBy: { deletedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          merchant: { select: { id: true, businessName: true } },
          _count: { select: { redemptions: true } },
          content: { select: { imageUrls: true } },
          redemption: { select: { configuration: true } },
        },
      }),
      prisma.merchantOffer.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: offers,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return internalError(error);
  }
}
