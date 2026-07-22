import { NextRequest, NextResponse } from 'next/server'
import { MerchantStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'
import type {
  ChartSlice,
  MerchantAnalyticsDetailResponse,
  MerchantAnalyticsOverview,
  MerchantChartData,
  MerchantOfferPerformance,
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
  console.error('Merchant analytics detail error:', error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 },
  )
}

// Bucket helpers (same shape as the list endpoint)
const OFFER_PENDING = ['AWAITING_APPROVAL', 'PENDING_APPROVAL', 'VALIDATION_IN_PROGRESS', 'CHANGES_REQUESTED'] as const
const OFFER_REJECTED = ['REJECTED', 'VALIDATION_FAILED'] as const

// Status-color palette (matches admin UI theme)
const STATUS_COLORS: Record<string, string> = {
  LIVE: '#10b981',          // emerald-500
  PENDING: '#f59e0b',       // amber-500 (review)
  DRAFT: '#94a3b8',         // slate-400
  REJECTED: '#ef4444',      // red-500
  EXPIRED: '#f97316',       // orange-500
  ARCHIVED: '#64748b',      // slate-500
  PENDING_APPROVAL: '#f59e0b',
  AWAITING_APPROVAL: '#f59e0b',
  VALIDATION_IN_PROGRESS: '#3b82f6',
  VALIDATION_FAILED: '#ef4444',
  CHANGES_REQUESTED: '#a855f7',
  REPLACED: '#64748b',
}

const OFFER_TYPE_LABELS: Record<string, string> = {
  FLAT: 'Flat Discount',
  PERCENTAGE: 'Percentage Off',
  BUY_X_GET_Y: 'Buy X Get Y',
  flat_rate: 'Flat Rate',
  fixed_amount: 'Fixed Amount',
  percentage: 'Percentage Off',
  buy_x_get_y: 'Buy X Get Y',
}

const FUNNEL_STAGES = [
  { key: 'views', label: 'Views' },
  { key: 'saves', label: 'Saves' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'redemptions', label: 'Redemptions' },
] as const

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

// ============================================================================
// GET /api/admin/analytics/merchants/[merchantId]
// ============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ merchantId: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'admin') return unauthorized()

    const { merchantId } = await params
    if (!merchantId || !isUuid(merchantId)) return notFound('Merchant')

    // ----- 1. Fetch the merchant (with category + account) -----
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        account: { select: { email: true } },
      },
    })
    if (!merchant || merchant.deletedAt) return notFound('Merchant')

    // ----- 2. Fetch all the merchant's offers (with category for distribution) -----
    const offers = await prisma.merchantOffer.findMany({
      where: { merchantId, deletedAt: null },
      select: {
        id: true,
        title: true,
        status: true,
        offerType: true,
        categoryId: true,
        createdAt: true,
      },
    })

    // Bulk-load categories used by these offers
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

    // ----- 3. Offer status groupBy (overview buckets) -----
    const offerStatusGroups = await prisma.merchantOffer.groupBy({
      by: ['status'],
      where: { merchantId, deletedAt: null },
      _count: { _all: true },
    })

    const statusCounts: Record<string, number> = {}
    for (const g of offerStatusGroups) {
      statusCounts[g.status] = (g._count as any)._all ?? 0
    }
    const pickCount = (...keys: string[]) =>
      keys.reduce((sum, k) => sum + (statusCounts[k] ?? 0), 0)

    const totalOffers = offers.length
    const liveOffers = statusCounts['LIVE'] ?? 0
    const draftOffers = statusCounts['DRAFT'] ?? 0
    const pendingOffers = pickCount(...OFFER_PENDING)
    const rejectedOffers = pickCount(...OFFER_REJECTED)
    const expiredOffers = statusCounts['EXPIRED'] ?? 0

    // ----- 4. OfferAnalytics (views/saves/clicks) -----
    const analyticsGroups = await prisma.offerAnalytics.groupBy({
      by: ['offerId'],
      _sum: { viewCount: true, saveCount: true, clickCount: true },
      where: { offer: { merchantId, deletedAt: null } },
    })
    const analyticsByOffer = new Map<string, { views: number; saves: number; clicks: number }>()
    for (const g of analyticsGroups) {
      analyticsByOffer.set(g.offerId, {
        views: Number((g._sum as any).viewCount ?? 0),
        saves: Number((g._sum as any).saveCount ?? 0),
        clicks: Number((g._sum as any).clickCount ?? 0),
      })
    }
    let totalViews = 0
    let totalSaves = 0
    let totalClicks = 0
    for (const v of analyticsByOffer.values()) {
      totalViews += v.views
      totalSaves += v.saves
      totalClicks += v.clicks
    }

    // ----- 5. Redemption counts per offer (for the offer performance table) -----
    const redemptionGroups = await prisma.redemption.groupBy({
      by: ['offerId'],
      where: { offer: { merchantId, deletedAt: null } },
      _count: { _all: true },
      _sum: { discountAmount: true, savingsAmount: true },
    })
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

    // ----- 6. Daily trend (last 30 days) from RedemptionAnalytics rollup -----
    const today = startOfDay(new Date())
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)

    const dailyRows = await prisma.redemptionAnalytics.findMany({
      where: {
        merchantId,
        date: { gte: thirtyDaysAgo, lte: today },
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        totalRedemptions: true,
        totalSavings: true,
      },
    })

    // Build a continuous 30-day series (zero-fill missing days)
    const dailyMap = new Map<string, { redemptions: number; savings: number }>()
    for (const row of dailyRows) {
      const key = new Date(row.date).toISOString().slice(0, 10)
      dailyMap.set(key, {
        redemptions: row.totalRedemptions,
        savings: Number(row.totalSavings),
      })
    }
    const dailyTrend: MerchantChartData['dailyTrend'] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo)
      d.setDate(d.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      const found = dailyMap.get(key)
      dailyTrend.push({
        date: key,
        redemptions: found?.redemptions ?? 0,
        views: 0, // views are not in RedemptionAnalytics
        savings: found?.savings ?? 0,
      })
    }

    // ----- 7. Build overview -----
    const conversionRate = totalViews > 0 ? (totalRedemptions / totalViews) * 100 : null
    const averageDiscount = totalRedemptions > 0 ? totalDiscountSum / totalRedemptions : 0
    const averageSavings = totalRedemptions > 0 ? totalSavingsSum / totalRedemptions : 0

    const overview: MerchantAnalyticsOverview = {
      totalOffers,
      liveOffers,
      draftOffers,
      pendingOffers,
      rejectedOffers,
      expiredOffers,
      views: totalViews,
      saves: totalSaves,
      clicks: totalClicks,
      redemptions: totalRedemptions,
      conversionRate,
      averageDiscount,
      averageSavings,
    }

    // ----- 8. Build offer performance table -----
    const offerPerformance: MerchantOfferPerformance[] = offers
      .map((o) => {
        const eng = analyticsByOffer.get(o.id) ?? { views: 0, saves: 0, clicks: 0 }
        const red = redemptionByOffer.get(o.id) ?? { count: 0, discount: 0, savings: 0 }
        const offerConversion = eng.views > 0 ? (red.count / eng.views) * 100 : null
        return {
          id: o.id,
          title: o.title,
          status: o.status,
          views: eng.views,
          saves: eng.saves,
          clicks: eng.clicks,
          redemptions: red.count,
          conversionRate: offerConversion,
        }
      })
      // Sort by redemptions desc, then views desc
      .sort((a, b) => {
        if (b.redemptions !== a.redemptions) return b.redemptions - a.redemptions
        return b.views - a.views
      })

    // ----- 9. Build charts -----
    // 9a. Status distribution
    const statusDistribution: ChartSlice[] = Object.entries(statusCounts)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({
        label: k.replace(/_/g, ' '),
        value: v,
        color: STATUS_COLORS[k] ?? '#94a3b8',
      }))
      .sort((a, b) => b.value - a.value)

    // 9b. Category distribution (by offer categoryId)
    const categoryCounts: Record<string, number> = {}
    for (const o of offers) {
      const key = o.categoryId ? categoryNameById.get(o.categoryId) ?? 'Unknown' : 'Uncategorized'
      categoryCounts[key] = (categoryCounts[key] ?? 0) + 1
    }
    const categoryDistribution: ChartSlice[] = Object.entries(categoryCounts)
      .map(([k, v]) => ({ label: k, value: v }))
      .sort((a, b) => b.value - a.value)

    // 9c. Offer type distribution (secondary category axis)
    const offerTypeCounts: Record<string, number> = {}
    for (const o of offers) {
      const label = OFFER_TYPE_LABELS[o.offerType] ?? o.offerType
      offerTypeCounts[label] = (offerTypeCounts[label] ?? 0) + 1
    }
    // If the merchant has zero categories, fall back to offer type so the chart
    // is never empty.
    const finalCategoryDistribution =
      categoryDistribution.length > 1 || (categoryDistribution[0]?.label !== 'Uncategorized')
        ? categoryDistribution
        : Object.entries(offerTypeCounts).map(([k, v]) => ({ label: k, value: v }))

    // 9d. Funnel: views → saves → clicks → redemptions
    const funnel: ChartSlice[] = FUNNEL_STAGES.map((stage) => ({
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

    const charts: MerchantChartData = {
      statusDistribution,
      categoryDistribution: finalCategoryDistribution,
      dailyTrend,
      funnel,
    }

    return NextResponse.json({
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
    } satisfies MerchantAnalyticsDetailResponse)
  } catch (error) {
    return internalError(error)
  }
}
