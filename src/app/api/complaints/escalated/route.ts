import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";

function unauthorized() {
  return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
}

function internalError(error: unknown) {
  console.error("Escalated complaints error:", error);
  return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "Internal server error" } }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== "admin") return unauthorized();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));
    const status = searchParams.get("status");

    const where: any = { complaint: { status: "ESCALATED" } };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.complaintEscalation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          complaint: {
            include: {
              offer: { select: { id: true, title: true } },
              merchant: { select: { id: true, businessName: true, logoUrl: true } },
              employee: { select: { id: true, firstName: true, lastName: true } },
              company: { select: { id: true, name: true } },
            },
          },
          companyAdmin: { select: { id: true, firstName: true, lastName: true } },
          superAdmin: { select: { id: true } },
        },
      }),
      prisma.complaintEscalation.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return internalError(error);
  }
}
