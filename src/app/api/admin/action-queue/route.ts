import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { QUEUE_TYPE_MAP, getPriorityLabel } from "@/lib/action-queue-types";

function unauthorized() {
  return NextResponse.json(
    {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized" },
    },
    { status: 401 },
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

function resolveTypeFilter(queueTypeParam: string | null, typeParam: string | null): string[] | undefined {
  if (queueTypeParam) {
    const mapping = QUEUE_TYPE_MAP[queueTypeParam];
    if (mapping) return [mapping.reviewComponent ? queueTypeParam : queueTypeParam].length
      ? [queueTypeParam]
      : undefined;
    return undefined;
  }
  if (typeParam && typeParam !== "ALL") {
    return typeParam.split(",").filter(Boolean);
  }
  return undefined;
}

function buildTypeWhere(queueTypes: string[] | undefined) {
  if (!queueTypes || queueTypes.length === 0) return undefined;
  if (queueTypes.length === 1) {
    const qt = queueTypes[0]!;
    return { metadata: { path: ["queueType"], equals: qt } };
  }
  return {
    OR: queueTypes.map((qt) => ({ metadata: { path: ["queueType"], equals: qt } })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== "admin") return unauthorized();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const queueType = searchParams.get("queueType");
    const type = searchParams.get("type");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") ?? "50")),
    );
    const q = searchParams.get("q");
    const tab = searchParams.get("tab");

    const where: Record<string, unknown> = {};

    if (status && status !== "ALL") {
      if (status === "ACTIVE") {
        where.status = { in: ["PENDING", "IN_PROGRESS"] };
      } else {
        where.status = status;
      }
    } else {
      where.status = { in: ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED"] };
    }

    const queueTypes = resolveTypeFilter(queueType, type);
    if (tab && tab !== "ALL") {
      const tabQueueTypes = Object.entries(QUEUE_TYPE_MAP)
        .filter(([, m]) => m.tabCategory === tab)
        .map(([k]) => k);
      const typeWhere = buildTypeWhere(tabQueueTypes);
      if (typeWhere) where.AND = [typeWhere];
    } else {
      const typeWhere = buildTypeWhere(queueTypes);
      if (typeWhere) where.AND = [typeWhere];
    }

    if (priority && priority !== "ALL") {
      const priorityMap: Record<string, [number, number]> = {
        HIGH: [4, 100],
        MEDIUM: [3, 3],
        STANDARD: [2, 2],
        LOW: [0, 1],
      };
      const range = priorityMap[priority];
      if (range) {
        where.priority = { gte: range[0], lte: range[1] };
      }
    }

    if (q) {
      const qFilter = {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { description: { contains: q, mode: "insensitive" as const } },
        ],
      };
      if (where.AND) {
        where.AND = [...(where.AND as any[]), qFilter];
      } else {
        where.AND = [qFilter];
      }
    }

    const [items, total, statusCounts, priorityCounts, typeCounts] = await Promise.all([
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
        where: { status: { in: ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "SKIPPED"] } },
      }),
      prisma.actionQueueItem.groupBy({
        by: ["priority"],
        _count: { _all: true },
        where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
      }),
      prisma.actionQueueItem.count({
        where: {
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      }),
    ]);

    const counts = {
      PENDING: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      FAILED: 0,
      SKIPPED: 0,
    };
    statusCounts.forEach((item: any) => {
      counts[item.status as keyof typeof counts] = item._count._all;
    });

    const priorityBuckets: Record<string, number> = {
      HIGH: 0, MEDIUM: 0, STANDARD: 0, LOW: 0,
    };
    priorityCounts.forEach((p: any) => {
      const label = getPriorityLabel(p.priority);
      priorityBuckets[label] = (priorityBuckets[label] ?? 0) + p._count._all;
    });

    const tabCounts: Record<string, number> = { ALL: typeCounts };
    for (const tabKey of ["MERCHANT_APPLICATIONS", "OFFER_APPROVALS", "COMPANY_ACTIVATION", "ISSUES", "ALERTS"]) {
      const tabQueueTypes = Object.entries(QUEUE_TYPE_MAP)
        .filter(([, m]) => m.tabCategory === tabKey)
        .map(([k]) => k);
      const tabWhere = buildTypeWhere(tabQueueTypes);
      const tabCountWhere: any = {
        status: { in: ["PENDING", "IN_PROGRESS"] },
        ...(tabWhere ? { AND: [tabWhere] } : {}),
      };
      tabCounts[tabKey] = await prisma.actionQueueItem.count({ where: tabCountWhere });
    }

    return NextResponse.json({
      success: true,
      data: items,
      meta: {
        counts,
        priorityBuckets,
        tabCounts,
        count: total,
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

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== "admin") return unauthorized();

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
      metadata,
    } = body;

    if (id && status) {
      const existing = await prisma.actionQueueItem.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "Action queue item not found" } },
          { status: 404 },
        );
      }

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
          changes: { from: existing.status, to: status } as any,
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
            message: "Missing required fields: title, type, referenceId, referenceType",
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
        metadata: metadata ?? undefined,
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
          error: { code: "VALIDATION", message: "Invalid reference ID — related record not found" },
        },
        { status: 400 },
      );
    }
    return internalError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== "admin") return unauthorized();

    const body = await request.json();
    const { id, status, assignedTo } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION", message: "Item ID is required" } },
        { status: 400 },
      );
    }

    const existing = await prisma.actionQueueItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Action queue item not found" } },
        { status: 404 },
      );
    }

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
          changes: { from: existing.status, to: status } as any,
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
          error: { code: "VALIDATION", message: 'Query parameter "id" is required' },
        },
        { status: 400 },
      );
    }

    const existing = await prisma.actionQueueItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Action queue item not found" } },
        { status: 404 },
      );
    }

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
        changes: { from: existing.status, to: "SKIPPED" } as any,
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
