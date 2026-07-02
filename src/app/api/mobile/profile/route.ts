import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  internalError,
  notFound,
  badRequest,
} from '@/lib/employee-helpers'
import { getAuthenticatedMobileEmployee } from '@/lib/mobile-auth'
import { createAuditLog } from '@/services/audit-log.service'

// GET /api/mobile/profile — current employee profile for the Profile tab.
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedMobileEmployee(request)
    if (!auth.ok) return auth.response

    const full = await prisma.employee.findUnique({
      where: { id: auth.employee.id },
      include: { company: { select: { id: true, name: true, approvedDomain: true } } },
    })
    if (!full) return notFound('Employee not found')
    return NextResponse.json({ success: true, data: full })
  } catch (error) {
    return internalError(error)
  }
}

// PATCH /api/mobile/profile — update profile fields. Mirrors the web
// `/api/employee/profile` PATCH contract 1:1 (same allow-list, same
// validation, same audit log).
export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthenticatedMobileEmployee(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const allowed = ['firstName', 'lastName', 'phone', 'jobTitle', 'department', 'avatarUrl'] as const
    const update: Record<string, unknown> = {}
    for (const f of allowed) {
      if (body[f] !== undefined) update[f] = body[f]
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: true, message: 'No changes' })
    }
    if (update.firstName !== undefined && (!update.firstName || String(update.firstName).trim().length < 1)) {
      return badRequest('First name is required')
    }
    if (update.lastName !== undefined && (!update.lastName || String(update.lastName).trim().length < 1)) {
      return badRequest('Last name is required')
    }

    const updated = await prisma.employee.update({
      where: { id: auth.employee.id },
      data: update,
    })

    void createAuditLog({
      actorType: 'employee',
      actorId: auth.employee.id,
      action: 'EMPLOYEE_PROFILE_UPDATED',
      entityType: 'employee',
      entityId: auth.employee.id,
      metadata: { changed: Object.keys(update), loginSource: 'mobile' },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return internalError(error)
  }
}
