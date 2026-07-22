import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'
import type {
  CompanyActiveEmployee,
  CompanyAnalyticsDetailCharts,
  CompanyAnalyticsDetailResponse,
  CompanyAnalyticsOverviewStats,
  CompanyTopCategory,
  CompanyUsedMerchant,
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

function notFound(entity: string) {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: `${entity} not found` } },
    { status: 404 },
  )
}

function internalError(error: unknown) {
  console.error('Company analytics detail error:', error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 },
  )
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const FUNNEL_STAGES = [
  { key: 'views', label: 'Views' },
  { key: 'saves', label: 'Saves' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'redeemed', label: 'Redeemed' },
] as const

// ============================================================================
// GET /api/admin/analytics/companies/[companyId]
// ============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'admin') return unauthorized()

    const { companyId } = await params
    if (!companyId || !isUuid(companyId)) return notFound('Company')

    // ----- 1. Fetch the company -----
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    })
    if (!company || company.deletedAt) return notFound('Company')

    // ----- 2. Employee status counts (single groupBy) -----
    const [employeeStatusGroups, employeesWithLogin] = await Promise.all([
      prisma.employee.groupBy({
        by: ['status'],
        where: { companyId, deletedAt: null },
        _count: { _all: true },
      }),
      prisma.employee.findMany({
        where: { companyId, deletedAt: null, NOT: { lastLoginAt: null } },
        select: { id: true, status: true, lastLoginAt: true },
      }),
    ])

    let activeCount = 0
    let inactiveCount = 0
    let neverLoggedInCount = 0
    let totalEmployees = 0
    for (const g of employeeStatusGroups) {
      const count = (g._count as any)._all ?? 0
      totalEmployees += count
      if (g.status === 'INVITED') {
        neverLoggedInCount += count
      } else if (g.status === 'ACTIVE') {
        activeCount += count
      } else {
        inactiveCount += count
      }
    }
    // Re-classify: employees with a `lastLoginAt` should NOT count as neverLoggedIn
    for (const e of employeesWithLogin) {
      if (e.status === 'INVITED') {
        neverLoggedInCount = Math.max(0, neverLoggedInCount - 1)
        activeCount += 1
      }
    }

    // ----- 3-7. Batch all the aggregations in parallel -----
    const thirtyDaysAgo = startOfDay(new Date())
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)

    const [
      redemptionGroups,
      redemptionPerCategoryGroups,
      offerEngagementByOffer,
      dailyTrendRows,
      topEmployeesAgg,
      topMerchantsAgg,
      allCategoriesLookup,
    ] = await Promise.all([
      // 3. Per-employee + per-merchant redemption totals for this company
      prisma.redemption.groupBy({
        by: ['employeeId', 'merchantId'],
        where: { companyId },
        _count: { _all: true },
        _sum: { savingsAmount: true, spentAmount: true, discountAmount: true },
        _max: { redeemedAt: true },
      }),

      // 4. Per-category redemptions
      prisma.redemption.findMany({
        where: { companyId },
        select: {
          offer: { select: { categoryId: true } },
        },
      }),

      // 5. Total offer engagement (views/saves/clicks) for offers this company redeemed
      prisma.offerAnalytics.groupBy({
        by: ['offerId'],
        _sum: { viewCount: true, saveCount: true, clickCount: true },
        where: {
          offer: { redemptions: { some: { companyId } } },
        },
      }),

      // 6. Daily trend (last 30 days) from the daily rollup
      prisma.redemptionAnalytics.findMany({
        where: { companyId, date: { gte: thirtyDaysAgo } },
        orderBy: { date: 'asc' },
        select: { date: true, totalRedemptions: true, totalSavings: true },
      }),

      // 7. Top employees by total savings
      prisma.redemption.groupBy({
        by: ['employeeId'],
        where: { companyId },
        _count: { _all: true },
        _sum: { savingsAmount: true, spentAmount: true },
        _max: { redeemedAt: true },
        orderBy: { _sum: { savingsAmount: 'desc' } },
        take: 10,
      }),

      // 8. Top merchants by total savings
      prisma.redemption.groupBy({
        by: ['merchantId'],
        where: { companyId },
        _count: { _all: true },
        _sum: { savingsAmount: true, spentAmount: true, discountAmount: true },
        _max: { redeemedAt: true },
        orderBy: { _sum: { savingsAmount: 'desc' } },
        take: 10,
      }),

      // 9. Category name lookup (preload all categories since the set is small)
      prisma.category.findMany({ select: { id: true, name: true } }),
    ])

    // ----- Build per-employee aggregates from (3) -----
    const employeeStats: Record<string, { redemptions: number; savings: number; spent: number }> = {}
    for (const r of redemptionGroups) {
      const e = employeeStats[r.employeeId] ?? { redemptions: 0, savings: 0, spent: 0 }
      e.redemptions += (r._count as any)._all ?? 0
      e.savings += Number((r._sum as any).savingsAmount ?? 0)
      e.spent += Number((r._sum as any).spentAmount ?? 0)
      employeeStats[r.employeeId] = e
    }

    // ----- Build per-merchant aggregates from (3) -----
    const merchantStats: Record<string, {
      redemptions: number
      savings: number
      spent: number
      discount: number
      lastRedeemedAt: Date | null
    }> = {}
    for (const r of redemptionGroups) {
      const m = merchantStats[r.merchantId] ?? {
        redemptions: 0,
        savings: 0,
        spent: 0,
        discount: 0,
        lastRedeemedAt: null,
      }
      m.redemptions += (r._count as any)._all ?? 0
      m.savings += Number((r._sum as any).savingsAmount ?? 0)
      m.spent += Number((r._sum as any).spentAmount ?? 0)
      m.discount += Number((r._sum as any).discountAmount ?? 0)
      const last = (r._max as any).redeemedAt as Date | null
      if (last && (!m.lastRedeemedAt || last > m.lastRedeemedAt)) {
        m.lastRedeemedAt = last
      }
      merchantStats[r.merchantId] = m
    }

    // ----- Build unique-employee counts per merchant -----
    const merchantEmployeeSet: Record<string, Set<string>> = {}
    for (const r of redemptionGroups) {
      if (!merchantEmployeeSet[r.merchantId]) merchantEmployeeSet[r.merchantId] = new Set()
      merchantEmployeeSet[r.merchantId]!.add(r.employeeId)
    }

    // ----- Top category (in-memory count of redemptions by categoryId) -----
    const categoryCountMap: Record<string, number> = {}
    for (const r of redemptionPerCategoryGroups) {
      const key = r.offer?.categoryId ?? '__none__'
      categoryCountMap[key] = (categoryCountMap[key] ?? 0) + 1
    }
    const catNameById = new Map(allCategoriesLookup.map((c) => [c.id, c.name]))
    let topCategory: CompanyTopCategory | null = null
    {
      let bestKey: string | null = null
      let bestCount = 0
      for (const [k, v] of Object.entries(categoryCountMap)) {
        if (v > bestCount) {
          bestCount = v
          bestKey = k
        }
      }
      if (bestKey && bestKey !== '__none__') {
        topCategory = {
          categoryId: bestKey,
          categoryName: catNameById.get(bestKey) ?? 'Uncategorized',
          redemptions: bestCount,
        }
      } else if (bestKey === '__none__' && bestCount > 0) {
        topCategory = {
          categoryId: null,
          categoryName: 'Uncategorized',
          redemptions: bestCount,
        }
      }
    }

    // ----- Totals across the company -----
    let totalRedemptions = 0
    let totalSavings = 0
    let totalSpent = 0
    let totalDiscount = 0
    for (const r of redemptionGroups) {
      totalRedemptions += (r._count as any)._all ?? 0
      totalSavings += Number((r._sum as any).savingsAmount ?? 0)
      totalSpent += Number((r._sum as any).spentAmount ?? 0)
      totalDiscount += Number((r._sum as any).discountAmount ?? 0)
    }

    let totalViews = 0
    let totalSaves = 0
    let totalClicks = 0
    for (const g of offerEngagementByOffer) {
      totalViews += Number((g._sum as any).viewCount ?? 0)
      totalSaves += Number((g._sum as any).saveCount ?? 0)
      totalClicks += Number((g._sum as any).clickCount ?? 0)
    }
    const averageSaving = totalRedemptions > 0 ? totalSavings / totalRedemptions : 0

    // ----- Top employees (resolve names) -----
    const topEmployeeIds = topEmployeesAgg.map((e) => e.employeeId)
    const employeeDetails = topEmployeeIds.length
      ? await prisma.employee.findMany({
          where: { id: { in: topEmployeeIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            status: true,
            lastLoginAt: true,
            account: { select: { email: true } },
          },
        })
      : []
    const employeeById = new Map(employeeDetails.map((e) => [e.id, e]))
    const mostActiveEmployees: CompanyActiveEmployee[] = topEmployeesAgg
      .map((agg): CompanyActiveEmployee | null => {
        const e = employeeById.get(agg.employeeId)
        if (!e) return null
        return {
          id: e.id,
          firstName: e.firstName,
          lastName: e.lastName,
          email: e.account?.email ?? null,
          avatarUrl: e.avatarUrl,
          status: String(e.status),
          redemptions: (agg._count as any)._all ?? 0,
          totalSavings: Number((agg._sum as any).savingsAmount ?? 0),
          lastActive: e.lastLoginAt ? e.lastLoginAt.toISOString() : null,
        }
      })
      .filter((x): x is CompanyActiveEmployee => x !== null)

    // ----- Top merchants (resolve names) -----
    const topMerchantIds = topMerchantsAgg.map((m) => m.merchantId)
    const merchantDetails = topMerchantIds.length
      ? await prisma.merchant.findMany({
          where: { id: { in: topMerchantIds } },
          select: {
            id: true,
            businessName: true,
            logoUrl: true,
            category: { select: { id: true, name: true, slug: true } },
          },
        })
      : []
    const merchantById = new Map(merchantDetails.map((m) => [m.id, m]))
    const mostUsedMerchants: CompanyUsedMerchant[] = topMerchantsAgg
      .map((agg) => {
        const m = merchantById.get(agg.merchantId)
        const stats = merchantStats[agg.merchantId]
        if (!m || !stats) return null
        return {
          id: m.id,
          businessName: m.businessName,
          logoUrl: m.logoUrl,
          category: m.category,
          redemptions: stats.redemptions,
          totalSavings: stats.savings,
          totalSpent: stats.spent,
          uniqueEmployees: merchantEmployeeSet[agg.merchantId]?.size ?? 0,
          lastRedeemedAt: stats.lastRedeemedAt ? stats.lastRedeemedAt.toISOString() : null,
        }
      })
      .filter((x): x is CompanyUsedMerchant => x !== null)

    // ----- Charts -----
    // 9a. Category pie
    const categoryPie: CompanyAnalyticsDetailCharts['categoryPie'] = Object.entries(
      categoryCountMap,
    )
      .map(([k, v]) => ({
        label: k === '__none__' ? 'Uncategorized' : catNameById.get(k) ?? 'Unknown',
        value: v,
      }))
      .sort((a, b) => b.value - a.value)

    // 9b. Merchant pie
    const merchantPie: CompanyAnalyticsDetailCharts['merchantPie'] = Object.entries(
      merchantStats,
    )
      .map(([id, s]) => {
        const m = merchantById.get(id)
        return {
          label: m?.businessName ?? 'Unknown',
          value: s.redemptions,
        }
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)

    // 9c. Daily redemption line (last 30 days, zero-filled)
    const dailyMap = new Map<string, { redemptions: number; savings: number }>()
    for (const row of dailyTrendRows) {
      const key = new Date(row.date).toISOString().slice(0, 10)
      dailyMap.set(key, {
        redemptions: row.totalRedemptions,
        savings: Number(row.totalSavings),
      })
    }
    const dailyRedemptionLine: CompanyAnalyticsDetailCharts['dailyRedemptionLine'] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo)
      d.setDate(d.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      const found = dailyMap.get(key)
      dailyRedemptionLine.push({
        date: key,
        redemptions: found?.redemptions ?? 0,
        savings: found?.savings ?? 0,
      })
    }

    // 9d. Employee funnel (views → saves → clicks → redeemed)
    const employeeFunnel: CompanyAnalyticsDetailCharts['employeeFunnel'] = FUNNEL_STAGES.map(
      (stage) => ({
        label: stage.label,
        value:
          stage.key === 'views'
            ? totalViews
            : stage.key === 'saves'
              ? totalSaves
              : stage.key === 'clicks'
                ? totalClicks
                : totalRedemptions,
      }),
    )

    const charts: CompanyAnalyticsDetailCharts = {
      categoryPie,
      merchantPie,
      dailyRedemptionLine,
      employeeFunnel,
    }

    // ----- Build the overview stats -----
    const overview: CompanyAnalyticsOverviewStats = {
      employees: totalEmployees,
      active: activeCount,
      inactive: inactiveCount,
      neverLoggedIn: neverLoggedInCount,
      views: totalViews,
      saves: totalSaves,
      clicks: totalClicks,
      redeemed: totalRedemptions,
      averageSaving,
      topCategory,
    }

    return NextResponse.json({
      success: true,
      data: {
        company: {
          id: company.id,
          name: company.name,
          slug: company.slug,
          email: company.email,
          logo: company.logoUrl,
          status: company.status,
          employeeCount: company.employeeCount,
          city: company.city,
          state: company.state,
          country: company.country,
          industry: company.industry,
          createdAt: company.createdAt.toISOString(),
          approvedAt: company.approvedAt ? company.approvedAt.toISOString() : null,
        },
        overview,
        mostActiveEmployees,
        mostUsedMerchants,
        charts,
      },
    } satisfies CompanyAnalyticsDetailResponse)
  } catch (error) {
    return internalError(error)
  }
}
