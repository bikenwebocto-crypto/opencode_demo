import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  internalError,
  badRequest,
} from '@/lib/employee-helpers'
import { getAuthenticatedMobileEmployee } from '@/lib/mobile-auth'

// PATCH /api/mobile/notifications/read
//
// Bulk mark notifications as read. Accepts an array of `notificationIds`.
// When the array is empty, marks ALL of the employee's notifications as
// read (the "mark all as read" UX). Returns the count of notifications
// marked.
export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthenticatedMobileEmployee(request)
    if (!auth.ok) return auth.response

    const body = await request.json().catch(() => ({}))
    const ids: unknown = body?.notificationIds
    if (ids !== undefined && !Array.isArray(ids)) {
      return badRequest('notificationIds must be an array')
    }

    const where =
      Array.isArray(ids) && ids.length > 0
        ? { id: { in: ids as string[] }, employeeId: auth.employee.id, isRead: false }
        : { employeeId: auth.employee.id, isRead: false }

    const { count } = await prisma.notificationEvent.updateMany({
      where,
      data: { isRead: true, readAt: new Date() },
    })

    return NextResponse.json({ success: true, data: { marked: count } })
  } catch (error) {
    return internalError(error)
  }
}
