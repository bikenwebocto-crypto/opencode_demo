import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyAdmin, handleApiError } from '../../helpers'
import { getCurrentUser } from '@/lib/supabase/server'
import { companyEmployeeUpdateSchema } from '@/schemas'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user || !['admin', 'company_admin'].includes(user.userType)) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 },
      )
    }

    const { id } = await params

    let company = null
    if (user.userType === 'company_admin') {
      const companyContext = await getCompanyAdmin()
      company = companyContext.company
    }

    const employee = await prisma.employee.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(user.userType === 'company_admin' ? { companyId: company!.id } : {}),
      },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        _count: { select: { redemptions: true } },
      },
    })

    if (!employee) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' } },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data: employee })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
  
    if (!user || !['admin', 'company_admin'].includes(user.userType)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
        },
        { status: 401 },
      )
    }

    const { id } = await params
    const body = await request.json()

    let company = null
    let companyAdmin = null
    if (user.userType === 'company_admin') {
      const companyContext = await getCompanyAdmin()
      company = companyContext.company
      companyAdmin = companyContext.companyAdmin
    }
    const email_found = await prisma.employee.findFirst({
      where: {
        email: body.email,
        deletedAt: null}, }) 
    if(email_found){
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Email already exists' } },
        { status: 400 },
      )
    }  
    const employee = await prisma.employee.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(user.userType === 'company_admin' ? { companyId: company!.id } : {}),
      },
    })

    if (!employee) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' } },
        { status: 404 },
      )
    }

    // ----- STATUS UPDATE (legacy path) -----
    if (body.status !== undefined) {
      const { status } = body
      if (!['ACTIVE', 'INACTIVE'].includes(status)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION', message: 'Status must be ACTIVE or INACTIVE' } },
          { status: 400 },
        )
      }

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.employee.update({
          where: { id },
          data: { status },
        })
        await tx.account.updateMany({
          where: { profileId: id, profileType: 'EMPLOYEE' },
          data: { status },
        })
        const action = status === 'ACTIVE' ? 'EMPLOYEE_REACTIVATED' : 'EMPLOYEE_DEACTIVATED'
        await tx.auditLog.create({
          data: {
            actorType: user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'COMPANY_ADMIN',
            companyId: employee.companyId,
            action,
            entityType: 'EMPLOYEE',
            entityId: id,
            metadata: {
              changedBy: user.profileId,
              changedByType: user.userType,
              previousStatus: employee.status,
              newStatus: status,
              companyAdminId: companyAdmin?.id ?? null,
            },
          },
        })
        return result
      })

      return NextResponse.json({ success: true, data: updated })
    }

    // ----- PROFILE UPDATE (company_admin cannot change email / company / status) -----
    const parsed = companyEmployeeUpdateSchema.safeParse(body)
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

    const data = parsed.data
    const update: Record<string, unknown> = {}
    const before: Record<string, unknown> = {}
    const after: Record<string, unknown> = {}
    const changedFields: string[] = []

    if (data.firstName !== undefined) {
      if (!data.firstName.trim()) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION', message: 'First name cannot be empty' } },
          { status: 400 },
        )
      }
      before.firstName = employee.firstName
      after.firstName = data.firstName
      update.firstName = data.firstName
      changedFields.push('firstName')
    }
    if (data.lastName !== undefined) {
      if (!data.lastName.trim()) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION', message: 'Last name cannot be empty' } },
          { status: 400 },
        )
      }
      before.lastName = employee.lastName
      after.lastName = data.lastName
      update.lastName = data.lastName
      changedFields.push('lastName')
    }
    if (data.employeeId !== undefined) {
      const next = data.employeeId?.trim() || null
      if (next && next !== employee.employeeId) {
        const dupe = await prisma.employee.findFirst({
          where: { companyId: employee.companyId, employeeId: next, id: { not: id }, deletedAt: null },
        })
        if (dupe) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION', message: `Employee ID "${next}" already exists in this company` } },
            { status: 400 },
          )
        }
      }
      before.employeeId = employee.employeeId
      after.employeeId = next
      update.employeeId = next
      changedFields.push('employeeId')
    }
    if (data.department !== undefined) {
      const next = data.department?.trim() || null
      before.department = employee.department
      after.department = next
      update.department = next
      changedFields.push('department')
    }
    if (data.jobTitle !== undefined) {
      const next = data.jobTitle?.trim() || null
      before.jobTitle = employee.jobTitle
      after.jobTitle = next
      update.jobTitle = next
      changedFields.push('jobTitle')
    }
    if (data.phone !== undefined) {
      before.phone = employee.phone
      after.phone = data.phone ?? null
      update.phone = data.phone ?? null
      changedFields.push('phone')
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: true, message: 'No changes', data: employee })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.employee.update({
        where: { id },
        data: update as any,
        include: {
          company: { select: { id: true, name: true, slug: true } },
        },
      })

      await tx.auditLog.create({
        data: {
          actorType: user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'COMPANY_ADMIN',
          companyId: employee.companyId,
          action: 'EMPLOYEE_UPDATED',
          entityType: 'EMPLOYEE',
          entityId: id,
          metadata: {
            changedBy: user.profileId,
            changedByType: user.userType,
            companyAdminId: companyAdmin?.id ?? null,
            before,
            after,
            changedFields,
          } as any,
        },
      })

      return result
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Employee updated successfully',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
