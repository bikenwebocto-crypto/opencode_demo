import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyAdmin, handleApiError } from '../helpers'

export async function GET(request: NextRequest) {
  try {
    const { companyAdmin } = await getCompanyAdmin()
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20')))
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    const where: any = { companyAdminId: companyAdmin.id }
    if (unreadOnly) where.isRead = false

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notificationEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notificationEvent.count({ where }),
      prisma.notificationEvent.count({ where: { companyAdminId: companyAdmin.id, isRead: false } }),
    ])

    return NextResponse.json({
      success: true,
      data: notifications,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), unreadCount },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST() {
  try {
    const { companyAdmin } = await getCompanyAdmin()

    const result = await prisma.notificationEvent.updateMany({
      where: { companyAdminId: companyAdmin.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })

    return NextResponse.json({ success: true, data: { updated: result.count } })
  } catch (error) {
    return handleApiError(error)
  }
}
