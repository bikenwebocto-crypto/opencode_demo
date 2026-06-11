import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import {
  getEmployeeFromSession,
  unauthorized,
  notFound,
  badRequest,
  internalError,
} from '@/lib/employee-session'

export async function GET() {
  try {
    const employee = await getEmployeeFromSession()
    if (!employee) return unauthorized()
    const full = await prisma.employee.findUnique({
      where: { id: employee.id },
      include: { company: { select: { id: true, name: true, approvedDomain: true } } },
    })
    if (!full) return notFound('Employee not found')
    const { passwordHash, ...safe } = full
    return NextResponse.json({ success: true, data: safe })
  } catch (error) {
    return internalError(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const employee = await getEmployeeFromSession()
    if (!employee) return unauthorized()
    const user = await getCurrentUser()
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
      where: { id: employee.id },
      data: update,
    })
    await prisma.auditLog.create({
      data: {
        actorType: 'EMPLOYEE',
        action: 'EMPLOYEE_PROFILE_UPDATED',
        entityType: 'employee',
        entityId: employee.id,
        metadata: { changed: Object.keys(update) },
      },
    }).catch(() => null)
    const { passwordHash, ...safe } = updated
    return NextResponse.json({ success: true, data: safe, userId: user?.id })
  } catch (error) {
    return internalError(error)
  }
}
