import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAuditLog } from "@/services/audit-log.service";

function unauthorized() {
  return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
}

function notFound(entity: string) {
  return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: `${entity} not found` } }, { status: 404 });
}

function internalError(error: unknown) {
  console.error("Admin complaints error:", error);
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
    const priority = searchParams.get("priority");
    const q = searchParams.get("q");

    const where: any = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (q) {
      where.OR = [
        { description: { contains: q, mode: "insensitive" } },
        { offer: { title: { contains: q, mode: "insensitive" } } },
        { merchant: { businessName: { contains: q, mode: "insensitive" } } },
        { company: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          offer: { select: { id: true, title: true } },
          merchant: { select: { id: true, businessName: true, logoUrl: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
          company: { select: { id: true, name: true } },
          _count: { select: { escalations: true, actions: true } },
        },
      }),
      prisma.complaint.count({ where }),
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
