import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireAdmin,
  writeBillingAudit,
  writeBillingNotification,
  BILLING_AUDIT_ACTIONS,
} from '@/lib/billing/auth-helpers'

/**
 * POST /api/admin/billing/companies/[id]/review
 *
 * Body: { action: 'READY' | 'FLAGGED', note?: string }
 *
 * Records the admin's pre-renewal review decision. Does NOT modify
 * billing amounts — that remains QuickBooks' responsibility.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as {
    action?: string
    note?: string
  }
  const action = body.action
  const note = (body.note ?? '').trim()

  if (action !== 'READY' && action !== 'FLAGGED') {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'VALIDATION', message: 'action must be READY or FLAGGED' },
      },
      { status: 400 },
    )
  }

  try {
    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true, name: true, deletedAt: true },
    })
    if (!company || company.deletedAt) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } },
        { status: 404 },
      )
    }

    const profileId = auth.profileId
    const auditAction =
      action === 'READY'
        ? BILLING_AUDIT_ACTIONS.RENEWAL_READY
        : BILLING_AUDIT_ACTIONS.RENEWAL_FLAGGED

    await writeBillingAudit({
      action: auditAction,
      companyId: id,
      profileId,
      reason: note || undefined,
      metadata: { decision: action },
    })

    await writeBillingNotification({
      companyId: id,
      adminId: profileId,
      title:
        action === 'READY'
          ? `Renewal marked ready: ${company.name}`
          : `Renewal flagged for review: ${company.name}`,
      body:
        action === 'READY'
          ? 'Admin has marked the company ready for renewal invoice generation in QuickBooks.'
          : note || 'Admin has flagged this renewal for additional review.',
      referenceType: 'company_billing',
      referenceId: id,
      priority: action === 'FLAGGED' ? 'HIGH' : 'NORMAL',
    }).catch((err) =>
      console.error('Renewal review notification failed', err),
    )

    return NextResponse.json({
      success: true,
      message:
        action === 'READY'
          ? 'Company marked ready for renewal'
          : 'Company flagged for renewal review',
    })
  } catch (err) {
    console.error('Renewal review error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}
