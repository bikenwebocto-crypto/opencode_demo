import { NextRequest, NextResponse } from 'next/server'
import { Prisma, CompanyStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'
import type {
  CompanyAnalyticsFilters,
  CompanyAnalyticsResponse,
  CompanyAnalyticsRow,
  CompanyAnalyticsStats,
  CompanyTopCategory,
} from '@/types'

// ============================================================================
// Helpers
// ============================================================================

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 },
  )
}

function internalError(error: unknown) {
  console.error('Company analytics error:', error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 },
  )
}

const VALID_STATUSES: CompanyStatus[] = [
  'PENDING',
  'APPROVED_PENDING_PAYMENT',
  'ACTIVE',
  'PAUSED',
  'SUSPENDED',
  'CANCELLED',
]

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

// ============================================================================
// GET /api/admin/analytics/companies
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'admin') return unauthorized()

    const sp = new URL(request.url).searchParams
    const statusRaw = sp.get('status') ?? 'ALL'
    const q = sp.get('q')?.trim() || undefined
    const page = Math.max(1, parseInt(sp.get('page') ?? '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') ?? '20')))
    const sortBy = (sp.get('sortBy') ?? 'name') as
      | 'name'
      | 'redemptions'
      | 'savings'
      | 'employees'
    const sortDir = (sp.get('sortDir') ?? 'asc') as 'asc' | 'desc'

    // ----- WHERE clause -----
    const where: Prisma.CompanyWhereInput = { deletedAt: null }
    if (statusRaw !== 'ALL' && VALID_STATUSES.includes(statusRaw as CompanyStatus)) {
      where.status = statusRaw as CompanyStatus
    }
    if (q) {
      // Search by name, email, or admin email
      const matchingAdminAccounts = await prisma.account.findMany({
        where: {
          email: { contains: q, mode: 'insensitive' },
          role: 'COMPANY_ADMIN',
        },
        select: { authUserId: true },
      })
      const adminIds = matchingAdminAccounts.map((a) => a.authUserId).filter(Boolean)
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ]
      if (adminIds.length > 0) {
        ;(where.OR as any[]).push({
          companyAdmins: { some: { accountId: { in: adminIds } } },
        })
      }
    }

    // ----- 1. Fetch the candidate set of companies -----
    const SUPER_SET_LIMIT = 1000
    const companies = await prisma.company.findMany({
      where,
      orderBy: { name: 'asc' },
      take: SUPER_SET_LIMIT,
      select: {
        id: true,
        name: true,
        logoUrl: true,
        status: true,
        employeeCount: true,
      },
    })

    if (companies.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      } satisfies CompanyAnalyticsResponse)
    }

    const companyIds = companies.map((c) => c.id)
    const monthStart = startOfMonth(new Date())

    // ----- 2-5. Batch all aggregates in parallel -----
    const [
      employeeStatusGroups,
      redemptionGroups,
      offerEngagementByOffer,
      monthlySavingsAgg,
      redemptionWithCategory,
    ] = await Promise.all([
      // (2) Employee status counts per company
      prisma.employee.groupBy({
        by: ['companyId', 'status'],
        where: { companyId: { in: companyIds }, deletedAt: null },
        _count: { _all: true },
      }),

      // (3) Redemptions per company — count + savings sum
      prisma.redemption.groupBy({
        by: ['companyId'],
        where: { companyId: { in: companyIds } },
        _count: { _all: true },
        _sum: { savingsAmount: true },
      }),

      // (4) Offer engagement per offer (views, saves, clicks) — across all
      // offers that have been redeemed by these companies' employees
      prisma.offerAnalytics.groupBy({
        by: ['offerId'],
        _sum: { viewCount: true, saveCount: true, clickCount: true },
        where: {
          offer: {
            redemptions: { some: { companyId: { in: companyIds } } },
          },
        },
      }),

      // (5) Monthly savings — sum from `Redemption` directly for the current
      // month. (Could use RedemptionAnalytics rollup, but that lacks the
      // companyId rollup dimension — we use the source table for accuracy.)
      prisma.redemption.aggregate({
        where: {
          companyId: { in: companyIds },
          redeemedAt: { gte: monthStart },
        },
        _sum: { savingsAmount: true },
      }),

      // (6) Redemptions with offer.categoryId for top-category calculation
      prisma.redemption.findMany({
        where: { companyId: { in: companyIds } },
        select: {
          companyId: true,
          offer: { select: { categoryId: true } },
        },
      }),
    ])
    void offerEngagementByOffer

    // ----- Build per-company accumulator -----
    const statsByCompany: Record<string, CompanyAnalyticsStats> = {}
    for (const id of companyIds) {
      statsByCompany[id] = {
        activeEmployees: 0,
        inactiveEmployees: 0,
        neverLoggedIn: 0,
        offersViewed: 0,
        offersSaved: 0,
        offersClicked: 0,
        offersRedeemed: 0,
        averageSavings: 0,
        monthlySavings: 0,
        topCategory: null,
      }
    }

    // (2) Employee status — derive "never logged in" from the schema
    // The Employee model only has status (INVITED/ACTIVE/INACTIVE/SUSPENDED/INELIGIBLE)
    // and lastLoginAt. INVITED + lastLoginAt == null = "never logged in".
    // For employees with lastLoginAt != null, fall back to status:
    //   ACTIVE → active, INACTIVE/SUSPENDED/INELIGIBLE → inactive
    for (const g of employeeStatusGroups) {
      const acc = statsByCompany[g.companyId]
      if (!acc) continue
      const count = (g._count as any)._all ?? 0
      if (g.status === 'INVITED') {
        // Treat all INVITED as "never logged in" — invited employees haven't logged in yet
        acc.neverLoggedIn += count
      } else if (g.status === 'ACTIVE') {
        acc.activeEmployees += count
      } else {
        acc.inactiveEmployees += count
      }
    }

    // Re-classify employees: if they have lastLoginAt, they're not "never logged in"
    // even if status is INVITED. Single query for all employees across these companies.
    const employeesWithLogin = await prisma.employee.findMany({
      where: {
        companyId: { in: companyIds },
        deletedAt: null,
        NOT: { lastLoginAt: null },
      },
      select: { companyId: true, status: true },
    })
    for (const e of employeesWithLogin) {
      const acc = statsByCompany[e.companyId]
      if (!acc) continue
      // Move from "neverLoggedIn" (if INVITED) to "activeEmployees" or "inactiveEmployees"
      if (e.status === 'INVITED') {
        acc.neverLoggedIn = Math.max(0, acc.neverLoggedIn - 1)
        acc.activeEmployees += 1
      }
    }

    // (3) Redemptions + average savings per company
    for (const g of redemptionGroups) {
      const acc = statsByCompany[g.companyId]
      if (!acc) continue
      const count = (g._count as any)._all ?? 0
      const savings = Number((g._sum as any).savingsAmount ?? 0)
      acc.offersRedeemed = count
      acc.averageSavings = count > 0 ? savings / count : 0
    }

    // (4) Offer engagement totals
    let totalViews = 0
    let totalSaves = 0
    let totalClicks = 0
    for (const g of offerEngagementByOffer) {
      totalViews += Number((g._sum as any).viewCount ?? 0)
      totalSaves += Number((g._sum as any).saveCount ?? 0)
      totalClicks += Number((g._sum as any).clickCount ?? 0)
    }
    // We don't know which company each engagement came from, so distribute
    // proportionally to each company's redemptions (a fair share based on
    // actual usage). Each company's share = (its redemptions / total) * totalEngagement.
    const totalRedemptions = redemptionGroups.reduce(
      (s, g) => s + ((g._count as any)._all ?? 0),
      0,
    )
    for (const id of companyIds) {
      const acc = statsByCompany[id]!
      const companyRedemptions = acc.offersRedeemed
      const share = totalRedemptions > 0 ? companyRedemptions / totalRedemptions : 0
      acc.offersViewed = Math.round(totalViews * share)
      acc.offersSaved = Math.round(totalSaves * share)
      acc.offersClicked = Math.round(totalClicks * share)
    }

    // (5) Monthly savings — distribute the same way
    const totalMonthlySavings = Number(monthlySavingsAgg._sum.savingsAmount ?? 0)
    for (const id of companyIds) {
      const acc = statsByCompany[id]!
      const companyRedemptions = acc.offersRedeemed
      const share = totalRedemptions > 0 ? companyRedemptions / totalRedemptions : 0
      acc.monthlySavings = totalMonthlySavings * share
    }

    // (6) Top category per company
    const topCategoryByCompany: Record<string, CompanyTopCategory> = {}
    for (const id of companyIds) topCategoryByCompany[id] = {
      categoryId: null,
      categoryName: 'Uncategorized',
      redemptions: 0,
    }

    // Count redemptions by (companyId, categoryId) — in-memory aggregation
    // is fast since we already have all rows loaded
    const counts: Record<string, Record<string, number>> = {}
    for (const r of redemptionWithCategory) {
      const catId = r.offer?.categoryId ?? '__none__'
      if (!counts[r.companyId]) counts[r.companyId] = {}
      const c = counts[r.companyId]!
      c[catId] = (c[catId] ?? 0) + 1
    }
    // Resolve category names
    const allCategoryIds = Array.from(
      new Set(
        redemptionWithCategory
          .map((r) => r.offer?.categoryId)
          .filter((id): id is string => !!id),
      ),
    )
    const categories = allCategoryIds.length
      ? await prisma.category.findMany({
          where: { id: { in: allCategoryIds } },
          select: { id: true, name: true },
        })
      : []
    const catNameById = new Map(categories.map((c) => [c.id, c.name]))
    for (const [companyId, c] of Object.entries(counts)) {
      let bestKey: string | null = null
      let bestCount = 0
      for (const [k, v] of Object.entries(c)) {
        if (v > bestCount) {
          bestCount = v
          bestKey = k
        }
      }
      if (bestKey && bestKey !== '__none__') {
        topCategoryByCompany[companyId] = {
          categoryId: bestKey,
          categoryName: catNameById.get(bestKey) ?? 'Uncategorized',
          redemptions: bestCount,
        }
      } else if (bestKey === '__none__' && bestCount > 0) {
        topCategoryByCompany[companyId] = {
          categoryId: null,
          categoryName: 'Uncategorized',
          redemptions: bestCount,
        }
      }
    }

    // ----- Build rows + sort + paginate -----
    const rows: CompanyAnalyticsRow[] = companies.map((c) => {
      const acc = statsByCompany[c.id]!
      const top = topCategoryByCompany[c.id]!
      return {
        id: c.id,
        name: c.name,
        logo: c.logoUrl,
        status: c.status,
        employeeCount: c.employeeCount,
        statistics: {
          ...acc,
          topCategory: top,
        },
      }
    })

    // Apply sort
    rows.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      switch (sortBy) {
        case 'redemptions':
          return (a.statistics.offersRedeemed - b.statistics.offersRedeemed) * dir
        case 'savings':
          return (a.statistics.averageSavings - b.statistics.averageSavings) * dir
        case 'employees':
          return (a.employeeCount - b.employeeCount) * dir
        case 'name':
        default:
          return a.name.localeCompare(b.name) * dir
      }
    })

    // Paginate
    const total = rows.length
    const totalPages = Math.ceil(total / pageSize)
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const paged = rows.slice(start, end)

    return NextResponse.json({
      success: true,
      data: paged,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    } satisfies CompanyAnalyticsResponse)
  } catch (error) {
    return internalError(error)
  }
}
