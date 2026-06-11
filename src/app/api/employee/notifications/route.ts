import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getEmployeeFromSession,
  unauthorized,
  internalError,
} from '@/lib/employee-session'

export async function GET(_request: NextRequest) {
  try {
    const employee = await getEmployeeFromSession()
    if (!employee) return unauthorized()

    const [rows, unread] = await Promise.all([
      prisma.notificationEvent.findMany({
        where: {
          employeeId: employee.id,
          OR: [
            { referenceType: { not: 'saved_offer' } },
            { referenceType: null },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notificationEvent.count({
        where: {
          employeeId: employee.id,
          isRead: false,
          OR: [
            { referenceType: { not: 'saved_offer' } },
            { referenceType: null },
          ],
        },
      }),
    ])

    return NextResponse.json({ success: true, data: rows, unread })
  } catch (error) {
    return internalError(error)
  }
}
