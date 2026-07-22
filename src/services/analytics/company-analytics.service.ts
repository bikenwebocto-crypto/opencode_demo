import { prisma } from '@/lib/prisma'
import { Prisma, CompanyStatus } from '@prisma/client'
import type {
  CompanyAnalyticsFilters,
  CompanyAnalyticsResponse,
  CompanyAnalyticsRow,
  CompanyAnalyticsStats,
  CompanyAnalyticsPagination,
  CompanyTopCategory,
  CompanyAnalyticsDetailResponse,
  CompanyAnalyticsOverviewStats,
  CompanyAnalyticsDetailCharts,
  CompanyActiveEmployee,
  CompanyUsedMerchant,
  ChartSlice,
} from '@/types'
import { FUNNEL_STAGES, DAILY_TREND_DAYS } from './shared/chart-palette'
import { buildDateSeries, startOfDay, startOfMonth } from './shared/date-utils'

// ============================================================================
// Company Analytics Service
//
// Same shape as MerchantAnalyticsService — list + detail. Routes delegate
// here instead of running their own queries.
// ============================================================================

const SUPER_SET_LIMIT = 1000
const VALID_STATUSES: CompanyStatus[] = [
  'PENDING',
  'APPROVED_PENDING_PAYMENT',
  'ACTIVE',
  'PAUSED',
  'SUSPENDED',
  'CANCELLED',
]

// ============================================================================
// LIST
// ============================================================================

export interface ListCompaniesResult {
  companies: CompanyAnalyticsRow[]
  pagination: CompanyAnalyticsPagination
}

export async function listCompanies(
  filters: CompanyAnalyticsFilters = {},
): Promise<ListCompaniesResult> {
  const {
    q,
    status,
    sortBy = 'name',
    sortDir = 'asc',
    page = 1,
    pageSize = 20,
  } = filters

  const where: Prisma.CompanyWhereInput = { deletedAt: null }
  if (status && status !== 'ALL' && VALID_STATUSES.includes(status as CompanyStatus)) {
    where.status = status as CompanyStatus
  }
  if (q) {
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
    return {
      companies: [],
      pagination: { page, pageSize, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
    }
  }

  const companyIds = companies.map((c) => c.id)
  const monthStart = startOfMonth(new Date())

  const [
    employeeStatusGroups,
    redemptionGroups,
    offerEngagementByOffer,
    monthlySavingsAgg,
    redemptionWithCategory,
  ] = await Promise.all([
    prisma.employee.groupBy({
      by: ['companyId', 'status'],
      where: { companyId: { in: companyIds }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.redemption.groupBy({
      by: ['companyId'],
      where: { companyId: { in: companyIds } },
      _count: { _all: true },
      _sum: { savingsAmount: true },
    }),
    prisma.offerAnalytics.groupBy({
      by: ['offerId'],
      _sum: { viewCount: true, saveCount: true, clickCount: true },
      where: {
        offer: { redemptions: { some: { companyId: { in: companyIds } } } },
      },
    }),
    prisma.redemption.aggregate({
      where: { companyId: { in: companyIds }, redeemedAt: { gte: monthStart } },
      _sum: { savingsAmount: true },
    }),
    prisma.redemption.findMany({
      where: { companyId: { in: companyIds } },
      select: { companyId: true, offer: { select: { categoryId: true } } },
    }),
  ])

  // Re-classify INVITED employees that have logged in
  const employeesWithLogin = await prisma.employee.findMany({
    where: { companyId: { in: companyIds }, deletedAt: null, NOT: { lastLoginAt: null } },
    select: { companyId: true, status: true },
  })

  // Stats + top category
  const statsByCompany = buildCompanyAccumulators(companyIds)
  accumulateEmployeeStatus(statsByCompany, employeeStatusGroups)
  reclassifyLoggedInEmployees(statsByCompany, employeesWithLogin)
  accumulateCompanyRedemptions(statsByCompany, redemptionGroups)

  // Distribute offer engagement (views/saves/clicks) and monthly savings
  // proportionally to each company's redemptions.
  const totalRedemptions = sumRedemptionCount(redemptionGroups)
  distributeOfferEngagement(statsByCompany, offerEngagementByOffer, totalRedemptions)
  distributeMonthlySavings(
    statsByCompany,
    Number(monthlySavingsAgg._sum.savingsAmount ?? 0),
    totalRedemptions,
  )

  // Top category per company (in-memory aggregation)
  // Fetch category names for ID resolution
  const allCatIds = Array.from(
    new Set(redemptionWithCategory.map((r) => r.offer?.categoryId).filter(Boolean)),
  )
  const catNameById = allCatIds.length > 0
    ? new Map(
        (await prisma.category.findMany({
          where: { id: { in: allCatIds as string[] } },
          select: { id: true, name: true },
        })).map((c) => [c.id, c.name]),
      )
    : new Map<string, string>()
  const topCategoryByCompany = computeTopCategoryByCompany(
    companyIds,
    redemptionWithCategory,
    catNameById,
  )

  // Build rows + sort + paginate
  const rows: CompanyAnalyticsRow[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
    logo: c.logoUrl,
    status: c.status,
    employeeCount: c.employeeCount,
    statistics: {
      ...statsByCompany[c.id]!,
      topCategory: topCategoryByCompany[c.id]!,
    },
  }))
  rows.sort((a, b) => compareCompanyRows(a, b, sortBy, sortDir))

  const total = rows.length
  const totalPages = Math.ceil(total / pageSize)
  const start = (page - 1) * pageSize
  const paged = rows.slice(start, start + pageSize)

  return {
    companies: paged,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  }
}

// ============================================================================
// DETAIL
// ============================================================================

export async function getCompanyDetail(
  companyId: string,
): Promise<CompanyAnalyticsDetailResponse | null> {
  // 1. Company
  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company || company.deletedAt) return null

  const thirtyDaysAgo = startOfDay(new Date())
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - (DAILY_TREND_DAYS - 1))

  // 2-7. Batch all aggregates in parallel
  const [
    employeeStatusGroups,
    employeesWithLogin,
    redemptionGroups,
    redemptionPerCategoryGroups,
    offerEngagementByOffer,
    dailyTrendRows,
    topEmployeesAgg,
    topMerchantsAgg,
    allCategoriesLookup,
  ] = await Promise.all([
    prisma.employee.groupBy({
      by: ['status'],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.employee.findMany({
      where: { companyId, deletedAt: null, NOT: { lastLoginAt: null } },
      select: { id: true, status: true, lastLoginAt: true },
    }),
    prisma.redemption.groupBy({
      by: ['employeeId', 'merchantId'],
      where: { companyId },
      _count: { _all: true },
      _sum: { savingsAmount: true, spentAmount: true, discountAmount: true },
      _max: { redeemedAt: true },
    }),
    prisma.redemption.findMany({
      where: { companyId },
      select: { offer: { select: { categoryId: true } } },
    }),
    prisma.offerAnalytics.groupBy({
      by: ['offerId'],
      _sum: { viewCount: true, saveCount: true, clickCount: true },
      where: {
        offer: { redemptions: { some: { companyId } } },
      },
    }),
    prisma.redemptionAnalytics.findMany({
      where: { companyId, date: { gte: thirtyDaysAgo } },
      orderBy: { date: 'asc' },
      select: { date: true, totalRedemptions: true, totalSavings: true },
    }),
    prisma.redemption.groupBy({
      by: ['employeeId'],
      where: { companyId },
      _count: { _all: true },
      _sum: { savingsAmount: true, spentAmount: true },
      _max: { redeemedAt: true },
      orderBy: { _sum: { savingsAmount: 'desc' } },
      take: 10,
    }),
    prisma.redemption.groupBy({
      by: ['merchantId'],
      where: { companyId },
      _count: { _all: true },
      _sum: { savingsAmount: true, spentAmount: true, discountAmount: true },
      _max: { redeemedAt: true },
      orderBy: { _sum: { savingsAmount: 'desc' } },
      take: 10,
    }),
    prisma.category.findMany({ select: { id: true, name: true } }),
  ])

  // Per-employee + per-merchant + company-wide totals (single pass over the
  // employeeId×merchantId groupBy).
  const employeeStats: Record<string, { redemptions: number; savings: number; spent: number }> = {}
  const merchantStats: Record<string, {
    redemptions: number
    savings: number
    spent: number
    discount: number
    lastRedeemedAt: Date | null
  }> = {}
  const merchantEmployeeSet: Record<string, Set<string>> = {}
  let totalRedemptions = 0
  let totalSavings = 0
  let totalSpent = 0
  let totalDiscount = 0
  for (const r of redemptionGroups) {
    const e = employeeStats[r.employeeId] ?? { redemptions: 0, savings: 0, spent: 0 }
    e.redemptions += Number(r._count?._all ?? 0)
    e.savings += Number(r._sum?.savingsAmount ?? 0)
    e.spent += Number(r._sum?.spentAmount ?? 0)
    employeeStats[r.employeeId] = e

    const m = merchantStats[r.merchantId] ?? {
      redemptions: 0,
      savings: 0,
      spent: 0,
      discount: 0,
      lastRedeemedAt: null,
    }
    m.redemptions += Number(r._count?._all ?? 0)
    m.savings += Number(r._sum?.savingsAmount ?? 0)
    m.spent += Number(r._sum?.spentAmount ?? 0)
    m.discount += Number(r._sum?.discountAmount ?? 0)
    const last = r._max?.redeemedAt as Date | null
    if (last && (!m.lastRedeemedAt || last > m.lastRedeemedAt)) {
      m.lastRedeemedAt = last
    }
    merchantStats[r.merchantId] = m

    if (!merchantEmployeeSet[r.merchantId]) {
      merchantEmployeeSet[r.merchantId] = new Set()
    }
    merchantEmployeeSet[r.merchantId]!.add(r.employeeId)

    totalRedemptions += Number(r._count?._all ?? 0)
    totalSavings += Number(r._sum?.savingsAmount ?? 0)
    totalSpent += Number(r._sum?.spentAmount ?? 0)
    totalDiscount += Number(r._sum?.discountAmount ?? 0)
  }

  let totalViews = 0
  let totalSaves = 0
  let totalClicks = 0
  for (const g of offerEngagementByOffer) {
    totalViews += Number(g._sum?.viewCount ?? 0)
    totalSaves += Number(g._sum?.saveCount ?? 0)
    totalClicks += Number(g._sum?.clickCount ?? 0)
  }

  // Employee status counts
  let activeCount = 0
  let inactiveCount = 0
  let neverLoggedInCount = 0
  let totalEmployees = 0
  for (const g of employeeStatusGroups) {
    const count = Number(g._count?._all ?? 0)
    totalEmployees += count
    if (g.status === 'INVITED') neverLoggedInCount += count
    else if (g.status === 'ACTIVE') activeCount += count
    else inactiveCount += count
  }
  // Reclassify INVITED employees that have logged in
  for (const e of employeesWithLogin) {
    if (e.status === 'INVITED') {
      neverLoggedInCount = Math.max(0, neverLoggedInCount - 1)
      activeCount += 1
    }
  }

  // Top category (in-memory aggregation over findMany result)
  const catNameById = new Map(allCategoriesLookup.map((c) => [c.id, c.name]))
  const categoryCountMap: Record<string, number> = {}
  for (const r of redemptionPerCategoryGroups) {
    const k = (r as any).offer?.categoryId ?? '__none__'
    categoryCountMap[k] = (categoryCountMap[k] ?? 0) + 1
  }
  const finalTopCategory = pickTopCategory(categoryCountMap, catNameById)

  // Top employees
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

  // Top merchants
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
    .map((agg): CompanyUsedMerchant | null => {
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

  // Charts
  const categoryPie: ChartSlice[] = Object.entries(categoryCountMap)
    .map(([k, v]) => ({
      label: k === '__none__' ? 'Uncategorized' : catNameById.get(k) ?? 'Unknown',
      value: v,
    }))
    .sort((a, b) => b.value - a.value)

  const merchantPie: ChartSlice[] = Object.entries(merchantStats)
    .map(([id, s]) => ({
      label: merchantById.get(id)?.businessName ?? 'Unknown',
      value: s.redemptions,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  const dailyMap = new Map<string, { redemptions: number; savings: number }>()
  for (const row of dailyTrendRows) {
    const key = new Date(row.date).toISOString().slice(0, 10)
    dailyMap.set(key, {
      redemptions: row.totalRedemptions,
      savings: Number(row.totalSavings),
    })
  }
  const dailyRedemptionLine = buildDateSeries(
    DAILY_TREND_DAYS,
    dailyMap,
    () => ({ redemptions: 0, savings: 0 }),
  ).map((d) => ({ date: d.date, redemptions: d.value.redemptions, savings: d.value.savings }))

  const employeeFunnel: ChartSlice[] = FUNNEL_STAGES.map((stage) => ({
    label: stage.label,
    value:
      stage.key === 'views'
        ? totalViews
        : stage.key === 'saves'
          ? totalSaves
          : stage.key === 'clicks'
            ? totalClicks
            : totalRedemptions,
  }))

  const charts: CompanyAnalyticsDetailCharts = {
    categoryPie,
    merchantPie,
    dailyRedemptionLine,
    employeeFunnel,
  }

  const averageSaving = totalRedemptions > 0 ? totalSavings / totalRedemptions : 0

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
    topCategory: finalTopCategory,
  }

  return {
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
  } satisfies CompanyAnalyticsDetailResponse
}

// ============================================================================
// Internal helpers
// ============================================================================

interface CompanyStatsAccumulator {
  activeEmployees: number
  inactiveEmployees: number
  neverLoggedIn: number
  offersViewed: number
  offersSaved: number
  offersClicked: number
  offersRedeemed: number
  averageSavings: number
  monthlySavings: number
  topCategory: CompanyTopCategory | null
}

function buildCompanyAccumulators(companyIds: string[]): Record<string, CompanyStatsAccumulator> {
  const out: Record<string, CompanyStatsAccumulator> = {}
  for (const id of companyIds) {
    out[id] = {
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
  return out
}

function accumulateEmployeeStatus(
  stats: Record<string, CompanyStatsAccumulator>,
  rows: ReadonlyArray<any>,
) {
  for (const g of rows) {
    const acc = stats[g.companyId]
    if (!acc) continue
    const count = Number(g._count?._all ?? 0)
    if (g.status === 'INVITED') acc.neverLoggedIn += count
    else if (g.status === 'ACTIVE') acc.activeEmployees += count
    else acc.inactiveEmployees += count
  }
}

function reclassifyLoggedInEmployees(
  stats: Record<string, CompanyStatsAccumulator>,
  rows: ReadonlyArray<any>,
) {
  for (const e of rows) {
    const acc = stats[e.companyId]
    if (!acc) continue
    if (e.status === 'INVITED') {
      acc.neverLoggedIn = Math.max(0, acc.neverLoggedIn - 1)
      acc.activeEmployees += 1
    }
  }
}

function accumulateCompanyRedemptions(
  stats: Record<string, CompanyStatsAccumulator>,
  rows: ReadonlyArray<any>,
) {
  for (const g of rows) {
    const acc = stats[g.companyId]
    if (!acc) continue
    const count = Number(g._count?._all ?? 0)
    const savings = Number(g._sum?.savingsAmount ?? 0)
    acc.offersRedeemed = count
    acc.averageSavings = count > 0 ? savings / count : 0
  }
}

function sumRedemptionCount(rows: ReadonlyArray<any>): number {
  return rows.reduce((s, g) => s + Number(g._count?._all ?? 0), 0)
}

function distributeOfferEngagement(
  stats: Record<string, CompanyStatsAccumulator>,
  rows: ReadonlyArray<any>,
  totalRedemptions: number,
) {
  let totalViews = 0
  let totalSaves = 0
  let totalClicks = 0
  for (const g of rows) {
    totalViews += Number(g._sum?.viewCount ?? 0)
    totalSaves += Number(g._sum?.saveCount ?? 0)
    totalClicks += Number(g._sum?.clickCount ?? 0)
  }
  for (const id of Object.keys(stats)) {
    const acc = stats[id]!
    const share = totalRedemptions > 0 ? acc.offersRedeemed / totalRedemptions : 0
    acc.offersViewed = Math.round(totalViews * share)
    acc.offersSaved = Math.round(totalSaves * share)
    acc.offersClicked = Math.round(totalClicks * share)
  }
}

function distributeMonthlySavings(
  stats: Record<string, CompanyStatsAccumulator>,
  totalMonthlySavings: number,
  totalRedemptions: number,
) {
  for (const id of Object.keys(stats)) {
    const acc = stats[id]!
    const share = totalRedemptions > 0 ? acc.offersRedeemed / totalRedemptions : 0
    acc.monthlySavings = totalMonthlySavings * share
  }
}

function compareCompanyRows(
  a: CompanyAnalyticsRow,
  b: CompanyAnalyticsRow,
  sortBy: 'name' | 'redemptions' | 'savings' | 'employees',
  sortDir: 'asc' | 'desc',
): number {
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
}

// ----- Top-category helpers -----

/**
 * Given a list of redemptions (or any object with `offer.categoryId`) and a
 * category-name lookup, return the most-redeemed category.
 */
function pickTopCategory(
  categoryCountMap: Record<string, number>,
  catNameById: Map<string, string>,
): CompanyTopCategory | null {
  let bestKey: string | null = null
  let bestCount = 0
  for (const [k, v] of Object.entries(categoryCountMap)) {
    if (v > bestCount) {
      bestCount = v
      bestKey = k
    }
  }
  if (!bestKey) return null
  if (bestKey !== '__none__') {
    return {
      categoryId: bestKey,
      categoryName: catNameById.get(bestKey) ?? 'Uncategorized',
      redemptions: bestCount,
    }
  }
  return {
    categoryId: null,
    categoryName: 'Uncategorized',
    redemptions: bestCount,
  }
}

function computeTopCategory(
  // Pass an array so the signature matches a groupBy shape; in practice we
  // receive a findMany result which is also iterable.
  redemptions: Array<{ offer: { categoryId: string | null } | null }>,
  catNameById: Map<string, string>,
): CompanyTopCategory | null {
  const counts: Record<string, number> = {}
  for (const r of redemptions) {
    const k = r.offer?.categoryId ?? '__none__'
    counts[k] = (counts[k] ?? 0) + 1
  }
  return pickTopCategory(counts, catNameById)
}

function computeTopCategoryByCompany(
  companyIds: string[],
  redemptions: Array<{ companyId: string; offer: { categoryId: string | null } | null }>,
  catNameById: Map<string, string>,
): Record<string, CompanyTopCategory> {
  const out: Record<string, CompanyTopCategory> = {}
  for (const id of companyIds) {
    out[id] = { categoryId: null, categoryName: 'Uncategorized', redemptions: 0 }
  }
  const counts: Record<string, Record<string, number>> = {}
  for (const r of redemptions) {
    const k = r.offer?.categoryId ?? '__none__'
    if (!counts[r.companyId]) counts[r.companyId] = {}
    const c = counts[r.companyId]!
    c[k] = (c[k] ?? 0) + 1
  }
  for (const [companyId, c] of Object.entries(counts)) {
    out[companyId] = pickTopCategory(c, catNameById) ?? {
      categoryId: null,
      categoryName: 'Uncategorized',
      redemptions: 0,
    }
  }
  return out
}
