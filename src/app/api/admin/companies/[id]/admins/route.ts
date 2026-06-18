import { NextRequest, NextResponse } from 'next/server'
import * as bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'
import { forbidden } from '@/lib/api-auth'
import {
  assertCanDisableAdmin,
  ensurePrimaryAdmin,
  PrimaryAdminGuardError,
  summarizeAdmins,
  toAdminSummary,
} from '@/lib/company-contact'
import { validateUserEmail } from '@/services/user-validation.service'

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 },
  )
}
function notFound(message = 'Company not found') {
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
function conflict(message: string) {
  return NextResponse.json(
    { success: false, error: { code: 'CONFLICT', message } },
    { status: 409 },
  )
}
function internalError(error: unknown) {
  console.error('Company admins API error:', error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 },
  )
}

function generateTempPassword(): string {
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*'
  let out = ''
  for (let i = 0; i < 12; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

interface AddAdminBody {
  firstName?: string
  lastName?: string
  email?: string
  role?: 'OWNER' | 'MEMBER'
  status?: 'ACTIVE' | 'INACTIVE'
}

/**
 * POST /api/admin/companies/[id]/admins
 * Create a new company admin. Auto-assigns primary if the company has
 * no active primary yet.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    if (user.userType !== 'admin') return forbidden(user.userType)

    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as AddAdminBody

    const firstName = (body.firstName ?? '').trim()
    const lastName = (body.lastName ?? '').trim()
    const email = (body.email ?? '').trim().toLowerCase()
    const role = body.role === 'OWNER' ? 'OWNER' : 'MEMBER'
    const status = body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'

    if (!firstName) return badRequest('First name is required')
    if (!lastName) return badRequest('Last name is required')
    if (!email) return badRequest('Email is required')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return badRequest('Invalid email address')
    }

    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    })
    if (!company || company.deletedAt) return notFound()

    // Reuse the existing email validator — it checks all profile
    // tables (AdminUser, Merchant, CompanyAdmin, Employee) plus the
    // Account table. We refuse any collision.
    const validation = await validateUserEmail(email)
    if (validation.exists) {
      return conflict(
        'Email is already assigned to another account in the system',
      )
    }

    const tempPassword = generateTempPassword()
    const passwordHash = await bcrypt.hash(tempPassword, 10)

    const result = await prisma.$transaction(async (tx) => {
      const admin = await tx.companyAdmin.create({
        data: {
          companyId: id,
          email,
          passwordHash,
          firstName,
          lastName,
          isPrimary: false,
          isActive: status === 'ACTIVE',
        },
      })

      await tx.account.create({
        data: {
          authUserId: admin.id,
          email,
          role: 'COMPANY_ADMIN',
          profileId: admin.id,
          profileType: 'COMPANY',
          status: status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
          createdBy: user.id,
        },
      })

      await tx.auditLog.create({
        data: {
          actorType: 'admin',
          adminId: user.id,
          action: 'COMPANY_ADMIN_CREATED',
          entityType: 'company_admin',
          entityId: admin.id,
          metadata: {
            companyId: id,
            email,
            role,
            status,
          },
        },
      })

      // Auto-fix primary: if this is the first active admin (or the
      // company has no active primary), promote it.
      await ensurePrimaryAdmin(id, tx)

      const refreshed = await tx.companyAdmin.findUnique({
        where: { id: admin.id },
      })
      return { admin: refreshed, tempPassword }
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          admin: result.admin ? toAdminSummary(result.admin) : null,
          tempPassword: result.tempPassword,
        },
        message:
          'Admin created. Share the temporary password securely — the admin will be asked to reset it on first login.',
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof PrimaryAdminGuardError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: error.code, message: error.message },
        },
        { status: 409 },
      )
    }
    if ((error as { code?: string })?.code === 'P2002') {
      return conflict('A company admin with this email already exists')
    }
    return internalError(error)
  }
}
