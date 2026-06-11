import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'
import { getMerchantFromSession } from '@/lib/merchant-session'

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 }
  )
}
function notFound(message = 'Merchant not found') {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message } },
    { status: 404 }
  )
}
function badRequest(message: string, details?: Record<string, string>) {
  return NextResponse.json(
    { success: false, error: { code: 'VALIDATION', message, details } },
    { status: 400 }
  )
}
function internalError(error: unknown) {
  console.error('Merchant profile API error:', error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 }
  )
}

const IMMEDIATE_FIELDS = [
  'contactName',
  'contactPhone',
  'description',
  'website',
  'coverImageUrl',
  'socialLinks',
  'businessHours',
  'tags',
] as const

const APPROVAL_FIELDS = ['businessName', 'categoryId', 'logoUrl'] as const

type ImmediateField = (typeof IMMEDIATE_FIELDS)[number]
type ApprovalField = (typeof APPROVAL_FIELDS)[number]

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'merchant') return unauthorized()
    const merchant = await getMerchantFromSession()
    if (!merchant) return notFound()

    const profile = await prisma.merchant.findUnique({
      where: { id: merchant.id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { offers: true, branches: true, redemptions: true } },
      },
    })
    if (!profile) return notFound()

    return NextResponse.json({ success: true, data: profile })
  } catch (error) {
    return internalError(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'merchant') return unauthorized()
    const merchant = await getMerchantFromSession()
    if (!merchant) return notFound()

    const body = await request.json()
    const {
      businessName,
      categoryId,
      logoUrl,
      contactName,
      contactPhone,
      description,
      website,
      coverImageUrl,
      socialLinks,
      businessHours,
      tags,
      changeReason,
    } = body

    const errors: Record<string, string> = {}
    if (contactName !== undefined && (!contactName || contactName.trim().length < 2)) {
      errors.contactName = 'Contact name is required (min 2 characters)'
    }
    if (website !== undefined && website && !/^https?:\/\//i.test(website)) {
      errors.website = 'Website must be a valid URL (http/https)'
    }
    if (logoUrl !== undefined && logoUrl && !/^https?:\/\//i.test(logoUrl)) {
      errors.logoUrl = 'Logo URL must be a valid URL (http/https)'
    }
    if (Object.keys(errors).length > 0) return badRequest('Validation failed', errors)

    const before = await prisma.merchant.findUnique({ where: { id: merchant.id } })
    if (!before) return notFound()

    const beforeSnapshot: Record<string, unknown> = {}
    const afterSnapshot: Record<string, unknown> = {}

    for (const f of [...IMMEDIATE_FIELDS, ...APPROVAL_FIELDS]) {
      const newVal = (body as any)[f]
      if (newVal === undefined) continue
      const oldVal = (before as any)[f]
      const a = oldVal === null || oldVal === undefined ? null : oldVal
      const b = newVal === null || newVal === undefined ? null : newVal
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        beforeSnapshot[f] = a
        afterSnapshot[f] = b
      }
    }

    const hasImmediateChanges = IMMEDIATE_FIELDS.some((f) => f in afterSnapshot)
    const hasApprovalChanges = APPROVAL_FIELDS.some((f) => f in afterSnapshot)

    if (!hasImmediateChanges && !hasApprovalChanges) {
      return NextResponse.json({ success: true, data: before, message: 'No changes' })
    }

    if (hasApprovalChanges && !changeReason) {
      return badRequest('A reason is required when changing business name, category, or logo', {
        changeReason: 'Please provide a reason for the requested change',
      })
    }

    if (hasImmediateChanges) {
      const immediateUpdate: Record<string, unknown> = {}
      for (const f of IMMEDIATE_FIELDS) {
        if (f in afterSnapshot) immediateUpdate[f] = afterSnapshot[f]
      }
      await prisma.merchant.update({ where: { id: merchant.id }, data: immediateUpdate })
    }

    await prisma.auditLog.create({
      data: {
        actorType: 'MERCHANT',
        merchantId: merchant.id,
        action: 'PROFILE_UPDATED',
        entityType: 'merchant',
        entityId: merchant.id,
        changes: { before: beforeSnapshot, after: afterSnapshot } as any,
        metadata: { hasApprovalChanges },
      },
    })

    if (hasApprovalChanges) {
      const existing = await prisma.actionQueueItem.findFirst({
        where: {
          referenceId: merchant.id,
          referenceType: 'merchant',
          type: 'PROFILE_EDIT_REQUEST',
          status: 'PENDING',
        },
      })
      if (!existing) {
        await prisma.actionQueueItem.create({
          data: {
            type: 'PROFILE_EDIT_REQUEST',
            title: `Profile change request: ${merchant.businessName}`,
            description: `Merchant ${merchant.businessName} requested changes to: ${(APPROVAL_FIELDS as readonly string[]).filter((f) => f in afterSnapshot).join(', ')}. Reason: ${changeReason}`,
            referenceId: merchant.id,
            referenceType: 'merchant',
            status: 'PENDING',
            priority: 2,
            metadata: {
              queueType: 'PROFILE_CHANGE_APPROVAL',
              requestedFields: afterSnapshot,
              originalValues: beforeSnapshot,
              reason: changeReason,
              approvalFields: (APPROVAL_FIELDS as readonly string[]).filter((f) => f in afterSnapshot),
            } as any,
          },
        })

        await prisma.auditLog.create({
          data: {
            actorType: 'MERCHANT',
            merchantId: merchant.id,
            action: 'PROFILE_CHANGE_REQUESTED',
            entityType: 'merchant',
            entityId: merchant.id,
            changes: { before: beforeSnapshot, after: afterSnapshot } as any,
            metadata: { changeReason },
          },
        })
      }
    }

    const updated = await prisma.merchant.findUnique({
      where: { id: merchant.id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { offers: true, branches: true, redemptions: true } },
      },
    })

    return NextResponse.json({
      success: true,
      data: updated,
      requiresApproval: hasApprovalChanges,
      message: hasApprovalChanges
        ? 'Profile updated. Sensitive changes are pending admin approval.'
        : 'Profile updated successfully.',
    })
  } catch (error) {
    return internalError(error)
  }
}
