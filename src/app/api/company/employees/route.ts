import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getCompanyAdmin, handleApiError, AuthError } from "../helpers";
import { validateUserEmail } from "@/services/user-validation.service";
import { emailService } from "@/lib/email/email";

export async function GET(request: NextRequest) {
  try {
    const { company } = await getCompanyAdmin();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")),
    );
    const status = searchParams.get("status");
    const q = searchParams.get("q");
    const sortBy = searchParams.get("sortBy") ?? "createdAt";
    const sortOrder = (searchParams.get("sortOrder") ?? "desc") as
      | "asc"
      | "desc";

    const where: any = { companyId: company.id, deletedAt: null };
    if (status && status !== "ALL") where.status = status;
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { department: { contains: q, mode: "insensitive" } },
      ];
    }

    const orderBy: any = {};
    const sortMap: Record<string, string> = {
      firstName: "firstName",
      lastName: "lastName",
      department: "department",
      status: "status",
      createdAt: "createdAt",
    };
    const sortField = sortMap[sortBy] ?? "createdAt";
    orderBy[sortField] = sortOrder;

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          department: true,
          jobTitle: true,
          status: true,
          employeeId: true,
          createdAt: true,
          invitedAt: true,
          lastLoginAt: true,
          joinMethod: true,

          account: {
            select: {
              email: true,
            },
          },

          _count: {
            select: {
              redemptions: true,
            },
          },
        },
      }),
      prisma.employee.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: employees,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { company, companyAdmin } = await getCompanyAdmin();
    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      department,
      jobTitle,
      phone,
      employeeId,
      joinMethod,
    } = body;

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION",
            message: "First name, last name, and email are required",
          },
        },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_EMAIL", message: "Invalid email address" },
        },
        { status: 400 },
      );
    }

    if (company.approvedDomain) {
      const domain = email.split("@")[1];
      if (domain !== company.approvedDomain) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "DOMAIN_MISMATCH",
              message: `Email domain must be ${company.approvedDomain}`,
            },
          },
          { status: 400 },
        );
      }
    }

    const validation = await validateUserEmail(email.toLowerCase().trim());
    if (validation.exists) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "EMAIL_ALREADY_EXISTS",
            message: "Email is already assigned to another account",
          },
        },
        { status: 409 },
      );
    }

    const empId = employeeId || `EMP-${Date.now()}`;

    const normalizedEmail = email.toLowerCase().trim();

    const result = await prisma.$transaction(async (tx) => {
      const pkId = crypto.randomUUID();
      const account = await tx.account.create({
        data: {
          authUserId: pkId,
          email: normalizedEmail,
          role: "EMPLOYEE",
          profileType: "EMPLOYEE",
          status: "ACTIVE",
        },
      });

      const employee = await tx.employee.create({
        data: {
          id: pkId,
          companyId: company.id,
          accountId: pkId,
          firstName,
          lastName,
          employeeId: empId,
          department: department || null,
          jobTitle: jobTitle || null,
          phone: phone || null,
          status: "ACTIVE",
          joinMethod: joinMethod || "manual",
        },
      });

      await tx.auditLog.create({
        data: {
          actorType: "COMPANY_ADMIN",
          companyId: company.id,
          action: "EMPLOYEE_CREATED",
          entityType: "EMPLOYEE",
          entityId: employee.id,
          metadata: {
            createdBy: companyAdmin.id,
            firstName,
            lastName,
            department,
          },
        },
      });

      await emailService.sendEmail({
        to: normalizedEmail,
        subject: `Welcome to ${company.name}! Your account has been created.`,
        html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">
                  <h2>Welcome to ${company.name}</h2>

                  <p>Hi ${employee.firstName},</p>

                  <p>Your employee account has been created successfully.</p>

                  <p>
                    <strong>Email:</strong> ${normalizedEmail}
                  </p>

                  <p>
                    Please log in and use the password reset flow to set your password.
                  </p>

                  <p>
                    <a href="${process.env.NEXT_PUBLIC_APP_URL}/login">
                      Login to your account
                    </a>
                  </p>

                  <br />

                  <p>
                    Best Regards,<br />
                    ${company.name} Team
                  </p>
                </div>
              `,
      });

      return employee;
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
