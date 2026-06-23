import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'
import { adminEmployeeUpdateSchema } from '@/schemas'
import { validateUserEmail } from '@/services/user-validation.service'

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 },
  )
}

function notFound() {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' } },
    { status: 404 },
  )
}

function badRequest(message: string) {
  return NextResponse.json(
    { success: false, error: { code: 'VALIDATION', message } },
    { status: 400 },
  )
}

function internalError(error: unknown) {
  console.error('Admin employee [id] error:', error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 },
  )
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'admin') return unauthorized()

    const { id } = await params
    const employee = await prisma.employee.findFirst({
      where: { id, deletedAt: null },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        _count: { select: { redemptions: true } },
      },
    })
    if (!employee) return notFound()
    return NextResponse.json({ success: true, data: employee })
  } catch (error) {
    return internalError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'admin') return unauthorized()

    const { id } = await params
    const body = await request.json()
    const parsed = adminEmployeeUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION',
            message: 'Validation failed',
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      )
    }

    const existing = await prisma.employee.findFirst({
      where: { id, deletedAt: null },
    })
    if (!existing) return notFound()

    const data = parsed.data
    const update: Record<string, unknown> = {}
    const before: Record<string, unknown> = {}
    const after: Record<string, unknown> = {}
    const changedFields: string[] = []

    if (data.firstName !== undefined) {
      if (!data.firstName.trim()) return badRequest('First name cannot be empty')
      before.firstName = existing.firstName
      after.firstName = data.firstName
      update.firstName = data.firstName
      changedFields.push('firstName')
    }
    if (data.lastName !== undefined) {
      if (!data.lastName.trim()) return badRequest('Last name cannot be empty')
      before.lastName = existing.lastName
      after.lastName = data.lastName
      update.lastName = data.lastName
      changedFields.push('lastName')
    }
    if (data.email !== undefined && data.email !== existing.email) {
      const validation = await validateUserEmail(data.email)
      if (validation.exists) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'EMAIL_ALREADY_EXISTS',
              message: 'Email is already assigned to another account',
            },
          },
          { status: 409 },
        )
      }
      before.email = existing.email
      after.email = data.email
      update.email = data.email
      changedFields.push('email')
    }
    if (data.employeeId !== undefined) {
      const next = data.employeeId?.trim() || null
      if (next && next !== existing.employeeId) {
        const dupe = await prisma.employee.findFirst({
          where: { companyId: existing.companyId, employeeId: next, id: { not: id }, deletedAt: null },
        })
        if (dupe) {
          return badRequest(`Employee ID "${next}" already exists in this company`)
        }
      }
      before.employeeId = existing.employeeId
      after.employeeId = next
      update.employeeId = next
      changedFields.push('employeeId')
    }
    if (data.department !== undefined) {
      const next = data.department?.trim() || null
      before.department = existing.department
      after.department = next
      update.department = next
      changedFields.push('department')
    }
    if (data.jobTitle !== undefined) {
      const next = data.jobTitle?.trim() || null
      before.jobTitle = existing.jobTitle
      after.jobTitle = next
      update.jobTitle = next
      changedFields.push('jobTitle')
    }
    if (data.phone !== undefined) {
      before.phone = existing.phone
      after.phone = data.phone ?? null
      update.phone = data.phone ?? null
      changedFields.push('phone')
    }
    if (data.status !== undefined && data.status !== existing.status) {
      before.status = existing.status
      after.status = data.status
      update.status = data.status
      changedFields.push('status')
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: true, message: 'No changes', data: existing })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.employee.update({
        where: { id },
        data: update as any,
        include: {
          company: { select: { id: true, name: true, slug: true } },
        },
      })

      if (changedFields.includes('email') || changedFields.includes('status')) {
        const accountUpdate: Record<string, unknown> = {}
        if (changedFields.includes('email')) accountUpdate.email = update.email
        if (changedFields.includes('status')) accountUpdate.status = update.status
        await tx.account.updateMany({
          where: { profileId: id, profileType: 'EMPLOYEE' },
          data: accountUpdate as any,
        })
      }

      await tx.auditLog.create({
        data: {
          actorType: 'admin',
          adminId: user.id,
          action: 'EMPLOYEE_UPDATED',
          entityType: 'employee',
          entityId: id,
          changes: { before, after, changedFields } as any,
        },
      })

      return result
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Employee updated successfully',
    })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'Duplicate value for a unique field' } },
        { status: 409 },
      )
    }
    return internalError(error)
  }
}
