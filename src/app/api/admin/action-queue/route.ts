import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";

function unauthorized() {
  return NextResponse.json(
    {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized" },
    },
    { status: 401 },
  );
}

function notFound() {
  return NextResponse.json(
    {
      success: false,
      error: { code: "NOT_FOUND", message: "Action queue item not found" },
    },
    { status: 404 },
  );
}

function internalError(error: unknown) {
  console.error("Action Queue API error:", error);
  return NextResponse.json(
    {
      success: false,
      error: { code: "INTERNAL", message: "Internal server error" },
    },
    { status: 500 },
  );
}

// GET /api/admin/action-queue — list items with filters
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") ?? "50")),
    );
    const q = searchParams.get("q");

    const where: Record<string, unknown> = {};
    if (status && status !== "ALL") where.status = status;
    if (type && type !== "ALL") where.type = type;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }
    const count = await prisma.actionQueueItem.count({ where: where as any });
    const [items, total, statusCounts] = await Promise.all([
      prisma.actionQueueItem.findMany({
        where: where as any,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          merchant: { select: { id: true, businessName: true, email: true } },
        },
      }),
      prisma.actionQueueItem.count({ where: where as any }),
      prisma.actionQueueItem.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      
    ]);
    const counts = {
      PENDING: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      FAILED: 0,
    };

    statusCounts.forEach((item: any) => {
      counts[item.status as keyof typeof counts] = item._count._all;
    });
    return NextResponse.json({
      success: true,
      data: items,
      meta: {
        counts,
        count,
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page * pageSize < total,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    return internalError(error);
  }
}

// POST /api/admin/action-queue — create or update item (PATCH-compatible via body status)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const {
      id,
      status,
      assignedTo,
      title,
      description,
      type,
      referenceId,
      referenceType,
      priority,
    } = body;

    if (id && status) {
      const existing = await prisma.actionQueueItem.findUnique({
        where: { id },
      });
      if (!existing) return notFound();

      const updated = await prisma.actionQueueItem.update({
        where: { id },
        data: {
          status,
          assignedTo: assignedTo ?? existing.assignedTo,
          completedAt:
            status === "COMPLETED"
              ? new Date()
              : status === "PENDING"
                ? null
                : undefined,
        },
        include: {
          merchant: { select: { id: true, businessName: true, email: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          actorType: "admin",
          adminId: user.id,
          action: `ACTION_QUEUE_${status}`,
          entityType: "action_queue",
          entityId: id,
          changes: { from: existing.status, to: status },
        },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: `Item ${status.toLowerCase()}`,
      });
    }

    if (!title || !type || !referenceId || !referenceType) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION",
            message:
              "Missing required fields: title, type, referenceId, referenceType",
          },
        },
        { status: 400 },
      );
    }

    const item = await prisma.actionQueueItem.create({
      data: {
        title,
        description,
        type,
        referenceId,
        referenceType,
        priority: priority ?? 0,
        status: "PENDING",
      },
      include: {
        merchant: { select: { id: true, businessName: true, email: true } },
      },
    });

    return NextResponse.json(
      { success: true, data: item, message: "Action queue item created" },
      { status: 201 },
    );
  } catch (error: any) {
    if (error?.code === "P2003") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION",
            message: "Invalid reference ID — related record not found",
          },
        },
        { status: 400 },
      );
    }
    return internalError(error);
  }
}

// PATCH /api/admin/action-queue — update item status / assignment
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const { id, status, assignedTo } = body;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION", message: "Item ID is required" },
        },
        { status: 400 },
      );
    }

    const existing = await prisma.actionQueueItem.findUnique({ where: { id } });
    if (!existing) return notFound();

    const data: Record<string, unknown> = {};
    if (status) {
      data.status = status;
      if (status === "COMPLETED") data.completedAt = new Date();
      if (status === "PENDING") data.completedAt = null;
    }
    if (assignedTo !== undefined) data.assignedTo = assignedTo;

    const updated = await prisma.actionQueueItem.update({
      where: { id },
      data: data as any,
      include: {
        merchant: { select: { id: true, businessName: true, email: true } },
      },
    });

    if (status) {
      await prisma.auditLog.create({
        data: {
          actorType: "admin",
          adminId: user.id,
          action: `ACTION_QUEUE_${status}`,
          entityType: "action_queue",
          entityId: id,
          changes: { from: existing.status, to: status },
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: status ? `Item ${status.toLowerCase()}` : "Item updated",
    });
  } catch (error) {
    return internalError(error);
  }
}

// DELETE /api/admin/action-queue — soft-delete (mark as SKIPPED)
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== "admin") return unauthorized();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION",
            message: 'Query parameter "id" is required',
          },
        },
        { status: 400 },
      );
    }

    const existing = await prisma.actionQueueItem.findUnique({ where: { id } });
    if (!existing) return notFound();

    await prisma.actionQueueItem.update({
      where: { id },
      data: { status: "SKIPPED" },
    });

    await prisma.auditLog.create({
      data: {
        actorType: "admin",
        adminId: user.id,
        action: "ACTION_QUEUE_SKIPPED",
        entityType: "action_queue",
        entityId: id,
        changes: { from: existing.status, to: "SKIPPED" },
      },
    });

    return NextResponse.json({
      success: true,
      data: null,
      message: "Item skipped",
    });
  } catch (error) {
    return internalError(error);
  }
}
