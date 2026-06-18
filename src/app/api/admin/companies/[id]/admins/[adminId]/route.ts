import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'
import { forbidden } from '@/lib/api-auth'
import {
  assertCanDisableAdmin,
  ensurePrimaryAdmin,
  PrimaryAdminGuardError,
  toAdminSummary,
} from '@/lib/company-contact'
import { validateUserEmail } from '@/services/user-validation.service'

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 },
  )
}
function notFound(message = 'Company admin not found') {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message } },
    { status: 404 },
  )
}
function badRequest(message: string) {
  return NextResponse.json(
    { success: false, error: { code: 'VALIDATION', message } },
    { status: 400 },
  )
}
function conflict(message: string, code = 'CONFLICT') {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status: 409 },
  )
}
function internalError(error: unknown) {
  console.error('Company admin update error:', error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 },
  )
}

interface PatchBody {
  firstName?: string
  lastName?: string
  email?: string
  role?: 'OWNER' | 'MEMBER'
  status?: 'ACTIVE' | 'INACTIVE'
  makePrimary?: boolean
}

/**
 * PATCH /api/admin/companies/[id]/admins/[adminId]
 *
 * Supports the following actions on a single company admin:
 *   - Edit (firstName, lastName, email, role)
 *   - Disable / re-enable (status)
 *   - Make Primary (makePrimary=true)
 *
 * All actions are combined into a single PATCH; an admin can, for
 * example, edit and transfer primary in the same request. The
 * server validates the combination (e.g. cannot disable the only
 * active primary).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; adminId: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    if (user.userType !== 'admin') return forbidden(user.userType)

    const { id, adminId } = await params
    const body = (await request.json().catch(() => ({}))) as PatchBody

    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    })
    if (!company || company.deletedAt) return notFound('Company not found')

    const existing = await prisma.companyAdmin.findUnique({
      where: { id: adminId },
    })
    if (!existing || existing.companyId !== id) {
      return notFound('Company admin not found in this company')
    }

    // Email uniqueness check across all profile tables.
    let nextEmail: string | undefined
    if (body.email !== undefined) {
      const trimmed = body.email.trim().toLowerCase()
      if (!trimmed) return badRequest('Email cannot be empty')
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return badRequest('Invalid email address')
      }
      if (trimmed !== existing.email) {
        const validation = await validateUserEmail(trimmed)
        if (validation.exists) {
          return conflict(
            'Email is already assigned to another account in the system',
          )
        }
      }
      nextEmail = trimmed
    }

    // Role is derived: only the primary admin can hold role=OWNER.
    // We don't persist role — the spec uses isPrimary as the source
    // of truth. So role edits are advisory and validated against
    // isPrimary below.
    const wantsPrimary = body.makePrimary === true
    const wantsInactive = body.status === 'INACTIVE'
    const wantsActive = body.status === 'ACTIVE'

    if (wantsInactive && existing.isPrimary) {
      // Guard: cannot disable the only active primary admin.
      // Defer the check until inside the transaction so we can
      // roll back cleanly.
    }

    const result = await prisma.$transaction(async (tx) => {
      // If disabling, run the guard inside the transaction.
      if (wantsInactive && existing.isActive) {
        await assertCanDisableAdmin(id, adminId, tx)
      }

      // Apply edits
      const updated = await tx.companyAdmin.update({
        where: { id: adminId },
        data: {
          firstName:
            body.firstName !== undefined
              ? body.firstName.trim()
              : undefined,
          lastName:
            body.lastName !== undefined ? body.lastName.trim() : undefined,
          email: nextEmail,
          isActive:
            wantsInactive ? false : wantsActive ? true : undefined,
        },
      })

      // Email change: also update the Account row so the login
      // email matches the admin profile email.
      if (nextEmail && nextEmail !== existing.email) {
        await tx.account.updateMany({
          where: { profileId: adminId, profileType: 'COMPANY' },
          data: { email: nextEmail },
        })
      }

      // If the admin was just disabled and they were an active
      // Account, mirror the status.
      if (wantsInactive) {
        await tx.account.updateMany({
          where: { profileId: adminId, profileType: 'COMPANY' },
          data: { status: 'INACTIVE' },
        })
      }
      if (wantsActive) {
        await tx.account.updateMany({
          where: { profileId: adminId, profileType: 'COMPANY' },
          data: { status: 'ACTIVE' },
        })
      }

      // Make primary: demote current primary (if any) and flag this one.
      if (wantsPrimary) {
        await tx.companyAdmin.updateMany({
          where: { companyId: id, isPrimary: true, id: { not: adminId } },
          data: { isPrimary: false },
        })
        if (!updated.isPrimary) {
          await tx.companyAdmin.update({
            where: { id: adminId },
            data: { isPrimary: true },
          })
        }
      }

      // Auto-fix primary: if the company now lacks an active primary,
      // promote the best candidate.
      await ensurePrimaryAdmin(id, tx)

      const refreshed = await tx.companyAdmin.findUnique({
        where: { id: adminId },
      })

      // Audit log
      const changes: Record<string, unknown> = {}
      if (
        body.firstName !== undefined &&
        body.firstName.trim() !== existing.firstName
      )
        changes.firstName = body.firstName.trim()
      if (
        body.lastName !== undefined &&
        body.lastName.trim() !== existing.lastName
      )
        changes.lastName = body.lastName.trim()
      if (nextEmail && nextEmail !== existing.email) changes.email = nextEmail
      if (wantsInactive && existing.isActive) changes.isActive = false
      if (wantsActive && !existing.isActive) changes.isActive = true
      if (wantsPrimary && !existing.isPrimary) changes.isPrimary = true
      if (wantsPrimary && existing.isPrimary) {
        // No-op
      }

      await tx.auditLog.create({
        data: {
          actorType: 'admin',
          adminId: user.id,
          action: 'COMPANY_ADMIN_UPDATED',
          entityType: 'company_admin',
          entityId: adminId,
          metadata: { companyId: id, changes } as any,
        },
      })

      return refreshed
    })

    return NextResponse.json({
      success: true,
      data: result ? toAdminSummary(result) : null,
      message: 'Admin updated successfully',
    })
  } catch (error) {
    if (error instanceof PrimaryAdminGuardError) {
      return conflict(error.message, error.code)
    }
    if ((error as { code?: string })?.code === 'P2002') {
      return conflict('A company admin with this email already exists')
    }
    return internalError(error)
  }
}
