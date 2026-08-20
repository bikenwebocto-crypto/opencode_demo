import { prisma } from '@/lib/prisma'
import { Prisma, MerchantStatus } from '@prisma/client'
import type {
  MerchantAnalyticsFilters,
  MerchantAnalyticsResponse,
  MerchantAnalyticsRow,
  MerchantAnalyticsSortBy,
  MerchantAnalyticsStats,
  MerchantAnalyticsPagination,
  MerchantAnalyticsDetailResponse,
  MerchantAnalyticsOverview,
  MerchantChartData,
  MerchantOfferPerformance,
  ChartSlice,
} from '@/types'
import {
  OFFER_STATUS_BUCKETS,
  OFFER_STATUS_COLORS,
  OFFER_TYPE_LABELS,
  FUNNEL_STAGES,
  DAILY_TREND_DAYS,
} from './shared/chart-palette'
import { buildDateSeries, startOfDay } from './shared/date-utils'

// ============================================================================
// Merchant Analytics Service
//
// Single source of truth for all merchant analytics business logic.
// Routes delegate to this service — no calculations, sorting, or aggregation
// happens in route handlers.
//
// Each method:
//   1. Fetches the data it needs (optimized Prisma queries)
//   2. Aggregates statistics
//   3. Calculates conversions / distributions
//   4. Prepares chart-ready datasets
//   5. Returns a typed DTO
// ============================================================================

const SUPER_SET_LIMIT = 1000
const VALID_SORTS: MerchantAnalyticsSortBy[] = [
  'redemptions',
  'offers',
  'views',
  'saves',
  'recent',
  'alphabetical',
]
const VALID_STATUSES: MerchantStatus[] = [
  'PENDING',
  'ACTIVE',
  'PAUSED',
  'SUSPENDED',
  'ARCHIVED',
  'REJECTED',
]

// ============================================================================
// LIST
// ============================================================================

export interface ListMerchantsResult {
  merchants: MerchantAnalyticsRow[]
  pagination: MerchantAnalyticsPagination
}

export async function listMerchants(
  filters: MerchantAnalyticsFilters = {},
): Promise<ListMerchantsResult> {
  const {
    q,
    status,
    categoryId,
    sortBy = 'redemptions',
    sortDir = 'desc',
    page = 1,
    pageSize = 20,
  } = filters

  // ----- WHERE clause -----
  const where: Prisma.MerchantWhereInput = { deletedAt: null }
  if (status && status !== 'ALL' && VALID_STATUSES.includes(status as MerchantStatus)) {
    where.status = status as MerchantStatus
  }
  if (categoryId && categoryId !== 'ALL') where.categoryId = categoryId
  if (q) {
    const matchingAccounts = await prisma.account.findMany({
      where: { email: { contains: q, mode: 'insensitive' }, profileType: 'MERCHANT' },
      select: { authUserId: true },
    })
    const accountIds = matchingAccounts.map((a) => a.authUserId).filter(Boolean)
    where.OR = [
      { businessName: { contains: q, mode: 'insensitive' } },
      { contactName: { contains: q, mode: 'insensitive' } },
    ]
    if (accountIds.length > 0) {
      ;(where.OR as any[]).push({ accountId: { in: accountIds } })
    }
  }

  // ----- Fetch candidate merchant set -----
  const merchantSet = await prisma.merchant.findMany({
    where,
    orderBy: { businessName: 'asc' },
    take: SUPER_SET_LIMIT,
    select: {
      id: true,
      businessName: true,
      logoUrl: true,
      status: true,
      city: true,
      createdAt: true,
      category: { select: { id: true, name: true, slug: true } },
    },
  })

  if (merchantSet.length === 0) {
    return {
      merchants: [],
      pagination: { page, pageSize, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
    }
  }

  const merchantIds = merchantSet.map((m) => m.id)

  // ----- Batch 3 groupBy calls + 1 findMany (offer→merchant map) -----
  const [offerGroups, analyticsGroups, redemptionGroups] = await Promise.all([
    prisma.merchantOffer.groupBy({
      by: ['merchantId', 'status'],
      where: { merchantId: { in: merchantIds }, deletedAt: null },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.offerAnalytics.groupBy({
      by: ['offerId'],
      _sum: { viewCount: true, saveCount: true, clickCount: true },
      where: { offer: { merchantId: { in: merchantIds }, deletedAt: null } },
    }),
    prisma.redemption.groupBy({
      by: ['merchantId'],
      where: { merchantId: { in: merchantIds } },
      _count: { _all: true },
      _sum: { savingsAmount: true },
    }),
  ])

  const offerIds = analyticsGroups.map((g) => g.offerId)
  const offers = offerIds.length
    ? await prisma.merchantOffer.findMany({
        where: { id: { in: offerIds } },
        select: { id: true, merchantId: true },
      })
    : []
  const offerToMerchant = new Map(offers.map((o) => [o.id, o.merchantId]))

  // ----- Aggregate per merchant in a single pass -----
  const statsByMerchant = buildMerchantAccumulators(merchantIds)
  accumulateOfferGroups(statsByMerchant, offerGroups)
  accumulateEngagement(statsByMerchant, analyticsGroups, offerToMerchant)
  accumulateRedemptions(statsByMerchant, redemptionGroups)

  // ----- Build rows + sort -----
  const rows: MerchantAnalyticsRow[] = merchantSet.map((m) =>
    toMerchantAnalyticsRow(m, statsByMerchant[m.id]!),
  )
  rows.sort((a, b) => compareMerchantRows(a, b, sortBy, sortDir))

  // ----- Paginate -----
  const total = rows.length
  const totalPages = Math.ceil(total / pageSize)
  const start = (page - 1) * pageSize
  const paged = rows.slice(start, start + pageSize)

  return {
    merchants: paged,
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

export async function getMerchantDetail(
  merchantId: string,
): Promise<MerchantAnalyticsDetailResponse | null> {
  // 1. Merchant
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      account: { select: { email: true } },
    },
  })
  if (!merchant || merchant.deletedAt) return null

  // 2. Offers + 3. Status groupBy + 4. Analytics + 5. Redemptions + 6. Daily
  // trend — all in parallel where possible.
  const thirtyDaysAgo = startOfDay(new Date())
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - (DAILY_TREND_DAYS - 1))

  const [
    offers,
    offerStatusGroups,
    analyticsGroups,
    redemptionGroups,
    rawDailyRows,
  ] = await Promise.all([
    prisma.merchantOffer.findMany({
      where: { merchantId, deletedAt: null },
      select: { id: true, title: true, status: true, offerType: true, categoryId: true, createdAt: true },
    }),
    prisma.merchantOffer.groupBy({
      by: ['status'],
      where: { merchantId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.offerAnalytics.groupBy({
      by: ['offerId'],
      _sum: { viewCount: true, saveCount: true, clickCount: true },
      where: { offer: { merchantId, deletedAt: null } },
    }),
    prisma.redemption.groupBy({
      by: ['offerId'],
      where: { offer: { merchantId, deletedAt: null } },
      _count: { _all: true },
      _sum: { discountAmount: true, savingsAmount: true },
    }),
    prisma.redemptionAnalytics.findMany({
      where: { merchantId, date: { gte: thirtyDaysAgo } },
      orderBy: { date: 'asc' },
      select: { date: true, totalRedemptions: true, totalSavings: true },
    }),
  ])

  const dailyRows: Array<{ date: Date; totalRedemptions: number; totalSavings: number }> =
    rawDailyRows.map((r) => ({
      date: r.date,
      totalRedemptions: Number(r.totalRedemptions ?? 0),
      totalSavings: Number(r.totalSavings ?? 0),
    }))

  // Resolve category names (one batched query)
  const offerCategoryIds = Array.from(
    new Set(offers.map((o) => o.categoryId).filter((id): id is string => !!id)),
  )
  const offerCategories = offerCategoryIds.length
    ? await prisma.category.findMany({
        where: { id: { in: offerCategoryIds } },
        select: { id: true, name: true },
      })
    : []
  const categoryNameById = new Map(offerCategories.map((c) => [c.id, c.name]))

  // Bucket the status counts
  const statusCounts: Record<string, number> = {}
  for (const g of offerStatusGroups) statusCounts[g.status] = (g._count as any)._all ?? 0
  const pickCount = (...keys: string[]) =>
    keys.reduce((sum, k) => sum + (statusCounts[k] ?? 0), 0)

  // Build per-offer analytics + redemption maps
  const analyticsByOffer = new Map<string, { views: number; saves: number; clicks: number }>()
  for (const g of analyticsGroups) {
    analyticsByOffer.set(g.offerId, {
      views: Number((g._sum as any).viewCount ?? 0),
      saves: Number((g._sum as any).saveCount ?? 0),
      clicks: Number((g._sum as any).clickCount ?? 0),
    })
  }
  const redemptionByOffer = new Map<string, { count: number; discount: number; savings: number }>()
  let totalRedemptions = 0
  let totalDiscountSum = 0
  let totalSavingsSum = 0
  for (const g of redemptionGroups) {
    const count = (g._count as any)._all ?? 0
    const discount = Number((g._sum as any).discountAmount ?? 0)
    const savings = Number((g._sum as any).savingsAmount ?? 0)
    redemptionByOffer.set(g.offerId, { count, discount, savings })
    totalRedemptions += count
    totalDiscountSum += discount
    totalSavingsSum += savings
  }
  let totalViews = 0
  let totalSaves = 0
  let totalClicks = 0
  for (const v of analyticsByOffer.values()) {
    totalViews += v.views
    totalSaves += v.saves
    totalClicks += v.clicks
  }

  // Build overview
  const conversionRate = totalViews > 0 ? (totalRedemptions / totalViews) * 100 : null
  const averageDiscount = totalRedemptions > 0 ? totalDiscountSum / totalRedemptions : 0
  const averageSavings = totalRedemptions > 0 ? totalSavingsSum / totalRedemptions : 0

  const overview: MerchantAnalyticsOverview = {
    totalOffers: offers.length,
    liveOffers: statusCounts['LIVE'] ?? 0,
    draftOffers: statusCounts['DRAFT'] ?? 0,
    pendingOffers: pickCount(...OFFER_STATUS_BUCKETS.pending),
    rejectedOffers: pickCount(...OFFER_STATUS_BUCKETS.rejected),
    expiredOffers: statusCounts['EXPIRED'] ?? 0,
    views: totalViews,
    saves: totalSaves,
    clicks: totalClicks,
    redemptions: totalRedemptions,
    conversionRate,
    averageDiscount,
    averageSavings,
  }

  // Offer performance table
  const offerPerformance: MerchantOfferPerformance[] = offers
    .map((o) => {
      const eng = analyticsByOffer.get(o.id) ?? { views: 0, saves: 0, clicks: 0 }
      const red = redemptionByOffer.get(o.id) ?? { count: 0, discount: 0, savings: 0 }
      return {
        id: o.id,
        title: o.title,
        status: o.status,
        views: eng.views,
        saves: eng.saves,
        clicks: eng.clicks,
        redemptions: red.count,
        conversionRate: eng.views > 0 ? (red.count / eng.views) * 100 : null,
      }
    })
    .sort((a, b) => {
      if (b.redemptions !== a.redemptions) return b.redemptions - a.redemptions
      return b.views - a.views
    })

  // Charts
  const charts = buildMerchantCharts({
    offers,
    statusCounts,
    categoryNameById,
    dailyRows,
    totalViews,
    totalSaves,
    totalClicks,
    totalRedemptions,
  })

  return {
    success: true,
    data: {
      merchant: {
        id: merchant.id,
        businessName: merchant.businessName,
        slug: merchant.slug,
        logoUrl: merchant.logoUrl,
        status: merchant.status as MerchantStatus,
        isFeatured: merchant.isFeatured,
        isHomepageMerchant: merchant.isHomepageMerchant,
        displayPriority: merchant.displayPriority,
        averageRating: Number(merchant.averageRating),
        city: merchant.city,
        state: merchant.state,
        country: merchant.country,
        category: merchant.category,
        createdAt: merchant.createdAt.toISOString(),
        liveAt: merchant.liveAt ? merchant.liveAt.toISOString() : null,
        totalRedemptions: merchant.totalRedemptions,
      },
      summary: overview,
      offerPerformance,
      charts,
    },
  } satisfies MerchantAnalyticsDetailResponse
}

// ============================================================================
// Internal helpers (not exported)
// ============================================================================

interface MerchantStatsAccumulator {
  totalOffers: number
  liveOffers: number
  draftOffers: number
  pendingOffers: number
  rejectedOffers: number
  expiredOffers: number
  totalViews: number
  totalSaves: number
  totalClicks: number
  totalRedemptions: number
  savingsSum: number
  lastOfferCreated: Date | null
}

function emptyMerchantStats(): MerchantStatsAccumulator {
  return {
    totalOffers: 0,
    liveOffers: 0,
    draftOffers: 0,
    pendingOffers: 0,
    rejectedOffers: 0,
    expiredOffers: 0,
    totalViews: 0,
    totalSaves: 0,
    totalClicks: 0,
    totalRedemptions: 0,
    savingsSum: 0,
    lastOfferCreated: null,
  }
}

function buildMerchantAccumulators(merchantIds: string[]): Record<string, MerchantStatsAccumulator> {
  const out: Record<string, MerchantStatsAccumulator> = {}
  for (const id of merchantIds) out[id] = emptyMerchantStats()
  return out
}

function accumulateOfferGroups(
  stats: Record<string, MerchantStatsAccumulator>,
  rows: ReadonlyArray<any>,
) {
  for (const row of rows) {
    const acc = stats[row.merchantId]
    if (!acc) continue
    const count = Number(row._count?._all ?? 0)
    acc.totalOffers += count
    if (row.status === OFFER_STATUS_BUCKETS.live) acc.liveOffers += count
    else if (row.status === OFFER_STATUS_BUCKETS.draft) acc.draftOffers += count
    else if ((OFFER_STATUS_BUCKETS.pending as readonly string[]).includes(row.status))
      acc.pendingOffers += count
    else if ((OFFER_STATUS_BUCKETS.rejected as readonly string[]).includes(row.status))
      acc.rejectedOffers += count
    else if (row.status === OFFER_STATUS_BUCKETS.expired) acc.expiredOffers += count

    const lastCreated = row._max?.createdAt as Date | null
    if (lastCreated && (!acc.lastOfferCreated || lastCreated > acc.lastOfferCreated)) {
      acc.lastOfferCreated = lastCreated
    }
  }
}

function accumulateEngagement(
  stats: Record<string, MerchantStatsAccumulator>,
  rows: ReadonlyArray<any>,
  offerToMerchant: Map<string, string>,
) {
  for (const row of rows) {
    const merchantId = offerToMerchant.get(row.offerId)
    if (!merchantId) continue
    const acc = stats[merchantId]
    if (!acc) continue
    acc.totalViews += Number(row._sum?.viewCount ?? 0)
    acc.totalSaves += Number(row._sum?.saveCount ?? 0)
    acc.totalClicks += Number(row._sum?.clickCount ?? 0)
  }
}

function accumulateRedemptions(
  stats: Record<string, MerchantStatsAccumulator>,
  rows: ReadonlyArray<any>,
) {
  for (const row of rows) {
    const acc = stats[row.merchantId]
    if (!acc) continue
    acc.totalRedemptions += Number(row._count?._all ?? 0)
    acc.savingsSum += Number(row._sum?.savingsAmount ?? 0)
  }
}

function toMerchantAnalyticsRow(
  m: {
    id: string
    businessName: string
    logoUrl: string | null
    status: MerchantStatus
    city: string | null
    category: { id: string; name: string; slug: string } | null
  },
  acc: MerchantStatsAccumulator,
): MerchantAnalyticsRow {
  const totalRedemptions = acc.totalRedemptions
  const conversionRate = acc.totalViews > 0 ? (totalRedemptions / acc.totalViews) * 100 : null
  const averageSavings = totalRedemptions > 0 ? acc.savingsSum / totalRedemptions : 0
  const statistics: MerchantAnalyticsStats = {
    totalOffers: acc.totalOffers,
    liveOffers: acc.liveOffers,
    draftOffers: acc.draftOffers,
    pendingOffers: acc.pendingOffers,
    rejectedOffers: acc.rejectedOffers,
    expiredOffers: acc.expiredOffers,
    totalViews: acc.totalViews,
    totalSaves: acc.totalSaves,
    totalClicks: acc.totalClicks,
    totalRedemptions,
    conversionRate,
    averageSavings,
    lastOfferCreated: acc.lastOfferCreated ? acc.lastOfferCreated.toISOString() : null,
  }
  return {
    id: m.id,
    businessName: m.businessName,
    logoUrl: m.logoUrl,
    status: m.status,
    category: m.category,
    city: m.city,
    statistics,
  }
}

function compareMerchantRows(
  a: MerchantAnalyticsRow,
  b: MerchantAnalyticsRow,
  sortBy: MerchantAnalyticsSortBy,
  sortDir: 'asc' | 'desc',
): number {
  const dir = sortDir === 'asc' ? 1 : -1
  switch (sortBy) {
    case 'redemptions':
      return (a.statistics.totalRedemptions - b.statistics.totalRedemptions) * dir
    case 'offers':
      return (a.statistics.totalOffers - b.statistics.totalOffers) * dir
    case 'views':
      return (a.statistics.totalViews - b.statistics.totalViews) * dir
    case 'saves':
      return (a.statistics.totalSaves - b.statistics.totalSaves) * dir
    case 'recent': {
      const ax = a.statistics.lastOfferCreated ? new Date(a.statistics.lastOfferCreated).getTime() : 0
      const bx = b.statistics.lastOfferCreated ? new Date(b.statistics.lastOfferCreated).getTime() : 0
      return (ax - bx) * dir
    }
    case 'alphabetical':
    default:
      return a.businessName.localeCompare(b.businessName) * dir
  }
}

// ----- Chart builders for the detail page -----

function buildMerchantCharts(args: {
  offers: Array<{ categoryId: string | null; offerType: string }>
  statusCounts: Record<string, number>
  categoryNameById: Map<string, string>
  dailyRows: Array<{ date: Date; totalRedemptions: number; totalSavings: number }>
  totalViews: number
  totalSaves: number
  totalClicks: number
  totalRedemptions: number
}): MerchantChartData {
  // Status pie
  const statusDistribution: ChartSlice[] = Object.entries(args.statusCounts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      label: k.replace(/_/g, ' '),
      value: v,
      color: OFFER_STATUS_COLORS[k] ?? '#94a3b8',
    }))
    .sort((a, b) => b.value - a.value)

  // Category distribution (real Category names, falls back to offer type)
  const categoryCounts: Record<string, number> = {}
  for (const o of args.offers) {
    const key = o.categoryId ? args.categoryNameById.get(o.categoryId) ?? 'Unknown' : 'Uncategorized'
    categoryCounts[key] = (categoryCounts[key] ?? 0) + 1
  }
  let categoryDistribution: ChartSlice[] = Object.entries(categoryCounts)
    .map(([k, v]) => ({ label: k, value: v }))
    .sort((a, b) => b.value - a.value)

  if (
    categoryDistribution.length <= 1 &&
    categoryDistribution[0]?.label === 'Uncategorized'
  ) {
    // Fall back to offer type so the chart is never empty
    const offerTypeCounts: Record<string, number> = {}
    for (const o of args.offers) {
      const label = OFFER_TYPE_LABELS[o.offerType] ?? o.offerType
      offerTypeCounts[label] = (offerTypeCounts[label] ?? 0) + 1
    }
    categoryDistribution = Object.entries(offerTypeCounts).map(([k, v]) => ({
      label: k,
      value: v,
    }))
  }

  // Daily trend (last N days, zero-filled)
  const dailyMap = new Map<string, { redemptions: number; savings: number }>()
  for (const r of args.dailyRows) {
    const key = new Date(r.date).toISOString().slice(0, 10)
    dailyMap.set(key, {
      redemptions: Number(r.totalRedemptions ?? 0),
      savings: Number(r.totalSavings ?? 0),
    })
  }
  const dailyTrend = buildDateSeries(
    DAILY_TREND_DAYS,
    dailyMap,
    () => ({ redemptions: 0, savings: 0 }),
  ).map((d) => ({
    date: d.date,
    redemptions: d.value.redemptions,
    views: 0,
    savings: d.value.savings,
  }))

  // Funnel
  const funnel: ChartSlice[] = FUNNEL_STAGES.map((stage) => ({
    label: stage.label,
    value:
      stage.key === 'views'
        ? args.totalViews
        : stage.key === 'saves'
          ? args.totalSaves
          : stage.key === 'clicks'
            ? args.totalClicks
            : args.totalRedemptions,
  }))

  return { statusDistribution, categoryDistribution, dailyTrend, funnel }
}
