import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEmployeeFromSession, unauthorized, internalError, companyInactive } from '@/lib/employee-session'

export async function GET(_request: NextRequest) {
  try {
    const employee = await getEmployeeFromSession()
    if (!employee) return unauthorized()
    if ('inactive' in employee) return companyInactive(employee.companyStatus)

    const { searchParams } = new URL(_request.url)
    const unreadOnly = searchParams.get('unread') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

    // In-app inbox only shows rows delivered through the IN_APP channel.
    const baseWhere: any = {
      employeeId: employee.id,
      channel: 'IN_APP',
      OR: [
        { referenceType: { not: 'saved_offer' } },
        { referenceType: null },
      ],
    }

    const where = unreadOnly ? { ...baseWhere, isRead: false } : baseWhere

    const [rows, unread, total] = await Promise.all([
      prisma.notificationEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notificationEvent.count({
        where: { ...baseWhere, isRead: false },
      }),
      prisma.notificationEvent.count({ where: baseWhere }),
    ])

    return NextResponse.json({
      success: true,
      data: rows,
      unread,
      meta: {
        page: 1,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit),
        unread,
      },
    })
  } catch (error) {
    return internalError(error)
  }
}

export async function POST(_request: NextRequest) {
  try {
    const employee = await getEmployeeFromSession()
    if (!employee) return unauthorized()
    if ('inactive' in employee) return companyInactive(employee.companyStatus)

    await prisma.notificationEvent.updateMany({
      where: {
        employeeId: employee.id,
        channel: 'IN_APP',
        isRead: false,
        OR: [
          { referenceType: { not: 'saved_offer' } },
          { referenceType: null },
        ],
      },
      data: { isRead: true, readAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return internalError(error)
  }
}
