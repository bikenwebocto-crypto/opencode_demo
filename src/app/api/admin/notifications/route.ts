import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unread') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

    const where: any = { adminId: user.profileId, channel: 'IN_APP' }
    if (unreadOnly) where.isRead = false

    const [data, unread, total] = await Promise.all([
      prisma.notificationEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notificationEvent.count({
        where: { ...where, isRead: false },
      }),
      prisma.notificationEvent.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data,
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
    console.error('[Admin Notifications]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.notificationEvent.updateMany({
      where: { adminId: user.profileId, channel: 'IN_APP', isRead: false },
      data: { isRead: true, readAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin Notifications Mark All]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
