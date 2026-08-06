import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'
import type { Recipient } from '@/services/notification.service'
import { publishBusinessNotification } from '@/services/business-notification.service'
import type { NotificationChannel, NotificationPriority } from '@prisma/client'

const ROLES = new Set(['admin', 'merchant', 'company_admin', 'employee'])
const CHANNELS = new Set<NotificationChannel>(['IN_APP', 'PUSH', 'EMAIL', 'SMS'])

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 })
    }

    const body = await request.json()
    const roles = Array.isArray(body.roles) ? body.roles.filter((role: unknown): role is string => typeof role === 'string' && ROLES.has(role)) : []
    const channels = Array.isArray(body.channels) ? body.channels.filter((channel: unknown): channel is NotificationChannel => typeof channel === 'string' && CHANNELS.has(channel as NotificationChannel)) : []
    if (!body.title || !body.message || !roles.length || !channels.length) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'title, message, roles, and channels are required' } }, { status: 400 })
    }

    const recipients: Recipient[] = []
    if (roles.includes('admin')) {
      const admins = await prisma.adminUser.findMany({ where: { isActive: true }, select: { id: true } })
      recipients.push(...admins.map((item) => ({ role: 'admin' as const, id: item.id })))
    }
    if (roles.includes('merchant')) {
      const merchants = await prisma.merchant.findMany({ where: { deletedAt: null }, select: { id: true } })
      recipients.push(...merchants.map((item) => ({ role: 'merchant' as const, id: item.id })))
    }
    if (roles.includes('company_admin')) {
      const admins = await prisma.companyAdmin.findMany({ where: { isActive: true }, select: { id: true } })
      recipients.push(...admins.map((item) => ({ role: 'company_admin' as const, id: item.id })))
    }
    if (roles.includes('employee')) {
      const employees = await prisma.employee.findMany({ where: { status: 'ACTIVE', deletedAt: null }, select: { id: true } })
      recipients.push(...employees.map((item) => ({ role: 'employee' as const, id: item.id })))
    }

    await publishBusinessNotification({
      type: body.type ?? 'ANNOUNCEMENT',
      recipients,
      title: String(body.title),
      message: String(body.message),
      priority: (body.priority ?? 'NORMAL') as NotificationPriority,
      channels,
      referenceType: 'announcement',
      referenceId: typeof body.referenceId === 'string' ? body.referenceId : undefined,
      metadata: { roles, announcedBy: user.profileId ?? user.id },
    })

    return NextResponse.json({ success: true, data: { recipientCount: recipients.length } })
  } catch (error) {
    console.error('[Admin Announcement] Failed', error)
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'Internal server error' } }, { status: 500 })
  }
}
