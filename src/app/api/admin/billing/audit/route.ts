import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, BILLING_AUDIT_ACTIONS } from '@/lib/billing/auth-helpers'

const ALL_ACTIONS = Object.values(BILLING_AUDIT_ACTIONS)

/**
 * GET /api/admin/billing/audit
 *
 * Returns the recent billing-related audit events across all companies.
 *   - companyId: optional filter
 *   - action:    optional single-action filter
 *   - page, pageSize
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId') ?? undefined
  const action = searchParams.get('action') ?? undefined
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10)),
  )

  try {
    const where: any = {
      action: action ? action : { in: ALL_ACTIONS },
    }
    if (companyId) {
      where.OR = [
        { entityType: 'company', entityId: companyId },
        { companyId },
      ]
    }

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          admin: { select: { id: true, firstName: true, lastName: true, email: true } },
          company: { select: { id: true, name: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (err) {
    console.error('Billing audit error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}
