import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/billing/auth-helpers'
import { buildCompanyBillingRow } from '@/lib/billing/summary'

const MS_PER_DAY = 24 * 60 * 60 * 1000

interface BillingQueryParams {
  status?: string
  alertFilter: boolean
  renewalWindow: number
  q: string
  page: number
  pageSize: number
}

interface RenewalDataRow {
  companyId: string
  companyName: string
  companyEmail: string
  billingStatus: string | null
  renewalDate: Date | null
  nextBillingDate: Date | null
  currentPeriodEnd: Date | null
  trialEndsAt: Date | null
}

function parseBillingQueryParams(searchParams: URLSearchParams): BillingQueryParams {
  const status = searchParams.get('status') ?? undefined
  const alertFilter = searchParams.get('alert') === 'true'
  const renewalWindow = Math.max(
    0,
    parseInt(searchParams.get('renewalWindow') ?? '0', 10) || 0,
  )
  const q = searchParams.get('q')?.trim() ?? ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10) || 20),
  )

  return { status, alertFilter, renewalWindow, q, page, pageSize }
}

async function resolveBillingCompanyIds(
  status?: string,
  renewalWindow = 0,
): Promise<string[] | undefined> {
  const now = new Date()
  let companyIdFilter: string[] | undefined

  if (status && status !== 'ALL') {
    const matched = await prisma.companyBilling.findMany({
      where: { billingStatus: status as any },
      select: { companyId: true },
    })
    companyIdFilter = matched.map((m) => m.companyId)
  }

  if (renewalWindow > 0) {
    const upper = new Date(now.getTime() + renewalWindow * MS_PER_DAY)
    const matched = await prisma.companyBilling.findMany({
      where: { renewalDate: { gte: now, lte: upper } },
      select: { companyId: true },
    })
    const renewalIds = matched.map((m) => m.companyId)

    if (companyIdFilter) {
      companyIdFilter = companyIdFilter.filter((id) => renewalIds.includes(id))
    } else {
      companyIdFilter = renewalIds
    }
  }

  return companyIdFilter
}

async function fetchRenewalData(): Promise<RenewalDataRow[]> {
  const now = new Date()
  const billingRows = await prisma.companyBilling.findMany({
    where: {
      OR: [
        { renewalDate: { lte: now } },
        { nextBillingDate: { lte: now } },
        { currentPeriodEnd: { lte: now } },
        { trialEndsAt: { lte: now } },
      ],
    },
    select: {
      companyId: true,
      billingStatus: true,
      renewalDate: true,
      nextBillingDate: true,
      currentPeriodEnd: true,
      trialEndsAt: true,
      company: {
        select: {
          id: true,
          name: true,
          email: true,
          deletedAt: true,
        },
      },
    },
  })

  return billingRows
    .filter((row) => row.company && !row.company.deletedAt)
    .map((row) => ({
      companyId: row.companyId,
      companyName: row.company.name,
      companyEmail: row.company.email,
      billingStatus: row.billingStatus,
      renewalDate: row.renewalDate,
      nextBillingDate: row.nextBillingDate,
      currentPeriodEnd: row.currentPeriodEnd,
      trialEndsAt: row.trialEndsAt,
    }))
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const { status, alertFilter, renewalWindow, q, page, pageSize } =
    parseBillingQueryParams(searchParams)

  try {
    const where: any = { deletedAt: null }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ]
    }

    const companyIdFilter = await resolveBillingCompanyIds(status, renewalWindow)
    if (companyIdFilter) {
      where.id = { in: companyIdFilter }
    }

    const [companies, total, renewalData] = await Promise.all([
      prisma.company.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, name: true, email: true },
      }),
      prisma.company.count({ where }),
      fetchRenewalData(),
    ])

    const rows = (
      await Promise.all(companies.map((c) => buildCompanyBillingRow(c.id)))
    ).filter((r): r is NonNullable<typeof r> => r !== null)

    const filteredRows = alertFilter
      ? rows.filter((r) => r.hasGamingAlert)
      : rows

    return NextResponse.json({
      success: true,
      data: filteredRows,
      renewalData,
      meta: {
        page,
        pageSize,
        total: alertFilter ? filteredRows.length : total,
        totalPages: Math.ceil(
          (alertFilter ? filteredRows.length : total) / pageSize,
        ),
      },
    })
  } catch (err) {
    console.error('Billing companies list error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}
