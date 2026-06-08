import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyAdmin, handleApiError } from '../../helpers'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { company, companyAdmin } = await getCompanyAdmin()
    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Status must be ACTIVE or INACTIVE' } },
        { status: 400 },
      )
    }

    const employee = await prisma.employee.findFirst({
      where: { id, companyId: company.id, deletedAt: null },
    })
    if (!employee) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' } },
        { status: 404 },
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.employee.update({
        where: { id },
        data: { status: status as any },
      })

      await tx.account.updateMany({
        where: { profileId: id, profileType: 'EMPLOYEE' },
        data: { status: status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE' },
      })

      const action = status === 'ACTIVE' ? 'EMPLOYEE_REACTIVATED' : 'EMPLOYEE_DEACTIVATED'
      await tx.auditLog.create({
        data: {
          actorType: 'COMPANY_ADMIN',
          companyId: company.id,
          action,
          entityType: 'EMPLOYEE',
          entityId: id,
          metadata: { changedBy: companyAdmin.id, previousStatus: employee.status, newStatus: status },
        },
      })

      return result
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return handleApiError(error)
  }
}
