import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/billing/auth-helpers'
import {
  buildCompanyBillingRow,
  type CompanyBillingRow,
} from '@/lib/billing/summary'
import { computeReadiness } from '@/lib/billing/gaming-alert'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params

  try {
    const company = await prisma.company.findUnique({
      where: { id },
    })
    if (!company || company.deletedAt) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } },
        { status: 404 },
      )
    }

    const billingRecord = await prisma.companyBilling.findUnique({
      where: { companyId: id },
    })

    const row: CompanyBillingRow | null = await buildCompanyBillingRow(id)
    if (!row) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } },
        { status: 404 },
      )
    }

    const readiness = computeReadiness({
      renewalDate: row.renewalDate,
      currentEmployees: row.currentEmployees,
      peakEnrolled30d: row.peakEnrolled30d,
      hasGamingAlert: row.hasGamingAlert,
      status: row.status,
    })

    const recentAudit = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'company', entityId: id },
          { companyId: id },
        ],
        action: {
          in: [
            'BILLING_STATUS_CHANGED',
            'RENEWAL_REVIEW_READY',
            'RENEWAL_REVIEW_FLAGGED',
            'RENEWAL_GAMING_ALERT_DETECTED',
            'PEAK_HEADCOUNT_RESET',
            'RENEWAL_PAID_CONFIRMED',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: { admin: { select: { id: true, firstName: true, lastName: true, email: true } } },
    })

    return NextResponse.json({
      success: true,
      data: {
        company: {
          id: company.id,
          name: company.name,
          email: company.email,
          city: company.city,
          country: company.country,
          status: company.status,
        },
        billing: row,
        billingRecord,
        readiness,
        recentAudit,
      },
    })
  } catch (err) {
    console.error('Billing company detail error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}
