import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEmployeeFromSession, unauthorized, internalError, companyInactive, notFound, badRequest } from '@/lib/employee-session'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const employee = await getEmployeeFromSession()
    if (!employee) return unauthorized()
    if ('inactive' in employee) return companyInactive(employee.companyStatus)
    const { id } = await params

    const existing = await prisma.notificationEvent.findFirst({
      where: {
        employeeId: employee.id,
        referenceType: 'saved_offer',
        referenceId: id,
      },
    })
    if (!existing) return notFound('Saved offer not found')

    await prisma.notificationEvent.delete({ where: { id: existing.id } })

    await prisma.merchantOffer.update({
      where: { id },
      data: { saveCount: { decrement: 1 } },
    }).catch(() => null)

    return NextResponse.json({ success: true })
  } catch (error) {
    return internalError(error)
  }
}
