import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyAdmin, handleApiError } from '../../helpers'

// import { NextRequest, NextResponse } from 'next/server'
// import { prisma } from '@/lib/prisma'
import { getCurrentUser } from "@/lib/supabase/server";
// import { getCompanyAdmin, handleApiError } from '../../helpers'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()

    if (
      !user ||
      !['admin', 'company_admin'].includes(user.userType)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
          },
        },
        { status: 401 },
      )
    }

    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION',
            message: 'Status must be ACTIVE or INACTIVE',
          },
        },
        { status: 400 },
      )
    }

    let company = null
    let companyAdmin = null

    if (user.userType === 'company_admin') {
      const companyContext = await getCompanyAdmin()

      company = companyContext.company
      companyAdmin = companyContext.companyAdmin
    }

    const employee = await prisma.employee.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(user.userType === 'company_admin'
          ? { companyId: company!.id }
          : {}),
      },
    })

    if (!employee) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Employee not found',
          },
        },
        { status: 404 },
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.employee.update({
        where: { id },
        data: {
          status,
        },
      })

      await tx.account.updateMany({
        where: {
          profileId: id,
          profileType: 'EMPLOYEE',
        },
        data: {
          status,
        },
      })

      const action =
        status === 'ACTIVE'
          ? 'EMPLOYEE_REACTIVATED'
          : 'EMPLOYEE_DEACTIVATED'

      await tx.auditLog.create({
        data: {
          actorType:
            user.role === 'SUPER_ADMIN'
              ? 'SUPER_ADMIN'
              : 'COMPANY_ADMIN',

          companyId: employee.companyId,

          action,

          entityType: 'EMPLOYEE',

          entityId: id,

          metadata: {
            changedBy: user.profileId,
            changedByType: user.userType,
            previousStatus: employee.status,
            newStatus: status,
            companyAdminId: companyAdmin?.id ?? null,
          },
        },
      })

      return result
    })

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    return handleApiError(error)
  }
}