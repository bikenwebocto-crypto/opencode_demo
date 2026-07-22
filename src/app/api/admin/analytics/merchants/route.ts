import { NextRequest, NextResponse } from 'next/server'
import { Prisma, MerchantStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'
import type {
  MerchantAnalyticsFilters,
  MerchantAnalyticsResponse,
  MerchantAnalyticsRow,
  MerchantAnalyticsSortBy,
  MerchantAnalyticsStats,
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

function badRequest(message: string) {
  return NextResponse.json(
    { success: false, error: { code: 'VALIDATION', message } },
    { status: 400 },
  )
}

function internalError(error: unknown) {
  console.error('Merchant analytics error:', error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 },
  )
}

const VALID_STATUSES: MerchantStatus[] = [
  'PENDING',
  'ACTIVE',
  'PAUSED',
  'SUSPENDED',
  'ARCHIVED',
  'REJECTED',
]

const VALID_SORTS: MerchantAnalyticsSortBy[] = [
  'redemptions',
  'offers',
  'views',
  'saves',
  'recent',
  'alphabetical',
]

// Mapping from `OfferStatus` (the schema enum) into the buckets the API exposes.
const OFFER_STATUS_BUCKETS = {
  total: null, // computed from the sum of the others
  live: 'LIVE',
  draft: 'DRAFT',
  pending: ['AWAITING_APPROVAL', 'PENDING_APPROVAL', 'VALIDATION_IN_PROGRESS', 'CHANGES_REQUESTED'] as const,
  rejected: ['REJECTED', 'VALIDATION_FAILED'] as const,
  expired: 'EXPIRED',
} as const

// ============================================================================
// Types (internal — local to this route)
// ============================================================================

interface MerchantLite {
  id: string
  businessName: string
  logoUrl: string | null
  status: MerchantStatus
  city: string | null
  createdAt: Date
  category: { id: string; name: string; slug: string } | null
}

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

function emptyStats(): MerchantStatsAccumulator {
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

function intoRow(
  m: MerchantLite,
  stats: MerchantStatsAccumulator,
): MerchantAnalyticsRow {
  const totalRedemptions = stats.totalRedemptions
  // Conversion = redemptions / views, but only when views > 0
  const conversionRate = stats.totalViews > 0 ? (totalRedemptions / stats.totalViews) * 100 : null
  const averageSavings = totalRedemptions > 0 ? stats.savingsSum / totalRedemptions : 0
  const statistics: MerchantAnalyticsStats = {
    totalOffers: stats.totalOffers,
    liveOffers: stats.liveOffers,
    draftOffers: stats.draftOffers,
    pendingOffers: stats.pendingOffers,
    rejectedOffers: stats.rejectedOffers,
    expiredOffers: stats.expiredOffers,
    totalViews: stats.totalViews,
    totalSaves: stats.totalSaves,
    totalClicks: stats.totalClicks,
    totalRedemptions,
    conversionRate,
    averageSavings,
    lastOfferCreated: stats.lastOfferCreated ? stats.lastOfferCreated.toISOString() : null,
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

// ============================================================================
// GET /api/admin/analytics/merchants
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'admin') return unauthorized()

    const sp = new URL(request.url).searchParams

    // ----- Parse filters -----
    const q = sp.get('q')?.trim() || undefined
    const statusRaw = sp.get('status') ?? 'ALL'
    const categoryId = sp.get('categoryId') || undefined
    const sortByRaw = (sp.get('sortBy') ?? 'redemptions') as MerchantAnalyticsSortBy
    const sortDir = (sp.get('sortDir') ?? 'desc') as 'asc' | 'desc'
    const page = Math.max(1, parseInt(sp.get('page') ?? '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') ?? '20')))

    if (!VALID_SORTS.includes(sortByRaw)) {
      return badRequest(`sortBy must be one of: ${VALID_SORTS.join(', ')}`)
    }
    const sortBy = sortByRaw
    if (sortDir !== 'asc' && sortDir !== 'desc') {
      return badRequest('sortDir must be "asc" or "desc"')
    }

    // ----- Build the merchant WHERE clause (status/category/search only) -----
    const where: Prisma.MerchantWhereInput = { deletedAt: null }
    if (statusRaw && statusRaw !== 'ALL' && VALID_STATUSES.includes(statusRaw as MerchantStatus)) {
      where.status = statusRaw as MerchantStatus
    }
    if (categoryId && categoryId !== 'ALL') where.categoryId = categoryId
    if (q) {
      // Match on businessName OR contactName OR email (via Account)
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
        ;(where.OR as any).push({ accountId: { in: accountIds } })
      }
    }

    // ----- Fetch the candidate merchant set (without heavy analytics) -----
    // We pull a generous superset so the in-memory sort/page still has enough
    // signal. For very large merchant counts this would need a smarter approach,
    // but for the admin dashboard it is well within budget.
    const SUPER_SET_LIMIT = 1000
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
      return NextResponse.json({
        success: true,
        data: {
          merchants: [],
          pagination: {
            page,
            pageSize,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
      } satisfies MerchantAnalyticsResponse)
    }

    const merchantIds = merchantSet.map((m) => m.id)

    // ----- Batch queries: 3 groupBy calls + 1 findMany (offer→merchant map) -----
    const [offerGroups, analyticsGroups, redemptionGroups] = await Promise.all([
      // 1. Offer counts by merchant + status (with _max createdAt for lastOfferCreated)
      prisma.merchantOffer.groupBy({
        by: ['merchantId', 'status'],
        where: { merchantId: { in: merchantIds }, deletedAt: null },
        _count: { _all: true },
        _max: { createdAt: true },
      }),

      // 2. Engagement (views/saves/clicks) per offer
      prisma.offerAnalytics.groupBy({
        by: ['offerId'],
        _sum: { viewCount: true, saveCount: true, clickCount: true },
        where: { offer: { merchantId: { in: merchantIds }, deletedAt: null } },
      }),

      // 3. Redemptions per merchant (count + savings sum)
      prisma.redemption.groupBy({
        by: ['merchantId'],
        where: { merchantId: { in: merchantIds } },
        _count: { _all: true },
        _sum: { savingsAmount: true },
      }),
    ])

    // Build the offer→merchant map once for the engagement groupBy
    const offerIds = analyticsGroups.map((g) => g.offerId)
    const offers = offerIds.length
      ? await prisma.merchantOffer.findMany({
          where: { id: { in: offerIds } },
          select: { id: true, merchantId: true },
        })
      : []
    const offerToMerchant = new Map(offers.map((o) => [o.id, o.merchantId]))

    // ----- Aggregate per merchant -----
    const statsByMerchant: Record<string, MerchantStatsAccumulator> = {}
    for (const id of merchantIds) statsByMerchant[id] = emptyStats()

    // Offers
    for (const row of offerGroups) {
      const acc = statsByMerchant[row.merchantId]
      if (!acc) continue
      const count = (row._count as any)._all ?? 0
      acc.totalOffers += count
      if (row.status === (OFFER_STATUS_BUCKETS.live as string)) {
        acc.liveOffers += count
      } else if (row.status === (OFFER_STATUS_BUCKETS.draft as string)) {
        acc.draftOffers += count
      } else if ((OFFER_STATUS_BUCKETS.pending as readonly string[]).includes(row.status)) {
        acc.pendingOffers += count
      } else if ((OFFER_STATUS_BUCKETS.rejected as readonly string[]).includes(row.status)) {
        acc.rejectedOffers += count
      } else if (row.status === (OFFER_STATUS_BUCKETS.expired as string)) {
        acc.expiredOffers += count
      }
      // Track last offer created
      const lastCreated = (row._max as any).createdAt as Date | null
      if (lastCreated) {
        if (!acc.lastOfferCreated || lastCreated > acc.lastOfferCreated) {
          acc.lastOfferCreated = lastCreated
        }
      }
    }

    // Engagement
    for (const row of analyticsGroups) {
      const merchantId = offerToMerchant.get(row.offerId)
      if (!merchantId) continue
      const acc = statsByMerchant[merchantId]
      if (!acc) continue
      acc.totalViews += Number((row._sum as any).viewCount ?? 0)
      acc.totalSaves += Number((row._sum as any).saveCount ?? 0)
      acc.totalClicks += Number((row._sum as any).clickCount ?? 0)
    }

    // Redemptions
    for (const row of redemptionGroups) {
      const acc = statsByMerchant[row.merchantId]
      if (!acc) continue
      acc.totalRedemptions += (row._count as any)._all ?? 0
      acc.savingsSum += Number((row._sum as any).savingsAmount ?? 0)
    }

    // ----- Build rows + in-memory sort -----
    const rows: MerchantAnalyticsRow[] = merchantSet.map((m) => {
      const acc = statsByMerchant[m.id] ?? emptyStats()
      return intoRow(m, acc)
    })

    rows.sort((a, b) => {
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
    })

    // ----- Paginate -----
    const total = rows.length
    const totalPages = Math.ceil(total / pageSize)
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const paged = rows.slice(start, end)

    return NextResponse.json({
      success: true,
      data: {
        merchants: paged,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    } satisfies MerchantAnalyticsResponse)
  } catch (error) {
    return internalError(error)
  }
}
