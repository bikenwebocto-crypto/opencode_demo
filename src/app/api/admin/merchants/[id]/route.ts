import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const merchant = await prisma.merchant.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        _count: {
          select: {
            offers: true,
            branches: true,
            redemptions: true,
            issues: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!merchant || merchant.deletedAt) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Merchant not found" },
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: merchant });
  } catch (error) {
    console.error("Merchant detail error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL", message: "Internal server error" },
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    console.log("** Authenticated user:", user);
    if (!user || user.userType !== "admin") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Unauthorized" },
        },
        { status: 401 },
      );
    }

    const { id } = await params;
    const body = await request.json();

    const merchant = await prisma.merchant.findUnique({ where: { id } });
    if (!merchant || merchant.deletedAt) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Merchant not found" },
        },
        { status: 404 },
      );
    }

    const updatableFields = [
      "businessName",
      "email",
      "contactName",
      "contactPhone",
      "description",
      "website",
      "categoryId",
      "addressLine1",
      "addressLine2",
      "city",
      "state",
      "postalCode",
      "country",
      "status",
      "adminNote",
    ];

    const data: Record<string, unknown> = {};
    for (const field of updatableFields) {
      if (body[field] !== undefined) data[field] = body[field];
    }

    if (body.password) {
      if (body.password.length < 8) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "VALIDATION",
              message: "Password must be at least 8 characters",
            },
          },
          { status: 400 },
        );
      }
      const bcrypt = await import("bcryptjs");
      data.passwordHash = await bcrypt.hash(body.password, 10);
    }

    if (data.status && data.status !== merchant.status) {
      await prisma.merchantStatusHistory.create({
        data: {
          merchantId: id,
          fromStatus: merchant.status,
          toStatus: data.status as any,
          changedBy: user.id,
          changedByType: "admin",
        },
      });
    }

    if (data.status === "ACTIVE") {
      data.approvedAt = merchant.approvedAt ?? new Date();
      data.liveAt = merchant.liveAt ?? new Date();
    }

    const updated = await prisma.merchant.update({
      where: { id },
      data: data as any,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        _count: {
          select: {
            offers: true,
            branches: true,
            redemptions: true,
            issues: true,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorType: "admin",
        adminId: user.id,
        action: "MERCHANT_UPDATED",
        entityType: "merchant",
        entityId: id,
        changes: Object.keys(data),
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Merchant updated successfully",
    });
  } catch (error) {
    console.error("Merchant update error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL", message: "Internal server error" },
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.userType !== "admin") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Unauthorized" },
        },
        { status: 401 },
      );
    }

    const { id } = await params;

    const merchant = await prisma.merchant.findUnique({ where: { id } });
    if (!merchant || merchant.deletedAt) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Merchant not found" },
        },
        { status: 404 },
      );
    }

    await prisma.merchant.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: user.id },
    });

    await prisma.auditLog.create({
      data: {
        actorType: "admin",
        adminId: user.id,
        action: "MERCHANT_DELETED",
        entityType: "merchant",
        entityId: id,
        changes: { businessName: merchant.businessName, email: merchant.email },
      },
    });

    return NextResponse.json({
      success: true,
      data: null,
      message: "Merchant deleted successfully",
    });
  } catch (error) {
    console.error("Merchant delete error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL", message: "Internal server error" },
      },
      { status: 500 },
    );
  }
}
