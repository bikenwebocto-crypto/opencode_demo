import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEmployeeFromSession, unauthorized, internalError, companyInactive, notFound, badRequest } from '@/lib/employee-session'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const employee = await getEmployeeFromSession()
    if (!employee) return unauthorized()
    if ('inactive' in employee) return companyInactive(employee.companyStatus)
    const { id } = await params

    const existing = await prisma.notificationEvent.findFirst({
      where: { id, employeeId: employee.id },
    })
    if (!existing) return notFound('Notification not found')

    const updated = await prisma.notificationEvent.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return internalError(error)
  }
}
