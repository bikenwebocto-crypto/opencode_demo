import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'
import {
  toMerchantDashboardRow,
  type MerchantOfferStats,
  type MerchantEngagement,
  type MerchantRelations,
} from '@/features/merchants/lib/merchant-dashboard'
import type {
  MerchantDashboardResponse,
  MerchantDashboardSummary,
  MerchantHealth,
  MerchantStatus,
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
  console.error('Merchant dashboard error:', error)
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

const VALID_HEALTH: MerchantHealth[] = ['HEALTHY', 'WARNING', 'CRITICAL']

const VALID_SORTS = [
  'priority',
  'createdAt',
  'status',
  'redemptions',
  'views',
  'lastActivity',
] as const

// ============================================================================
// GET /api/admin/merchants/dashboard
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'admin') return unauthorized()

    const sp = new URL(request.url).searchParams

    // ----- Parse filters -----
    const status = sp.get('status')
    const categoryId = sp.get('categoryId') || undefined
    const city = sp.get('city') || undefined
    const featuredParam = sp.get('featured')
    const homepageParam = sp.get('homepage')
    const healthParam = sp.get('health')
    const hasLiveOffersParam = sp.get('hasLiveOffers')
    const hasPendingOffersParam = sp.get('hasPendingOffers')
    const priorityMinParam = sp.get('priorityMin')
    const q = sp.get('q') || undefined
    const sortBy = sp.get('sortBy') ?? 'priority'
    const sortDir = (sp.get('sortDir') ?? 'desc') as 'asc' | 'desc'
    const page = Math.max(1, parseInt(sp.get('page') ?? '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') ?? '20')))

    // Build WHERE clause
    const where: any = { deletedAt: null }
    if (status && status !== 'ALL' && VALID_STATUSES.includes(status as MerchantStatus)) {
      where.status = status
    }
    if (categoryId && categoryId !== 'ALL') where.categoryId = categoryId
    if (city) where.city = { equals: city, mode: 'insensitive' }
    if (featuredParam === 'true') where.isFeatured = true
    if (featuredParam === 'false') where.isFeatured = false
    if (homepageParam === 'true') where.isHomepageMerchant = true
    if (homepageParam === 'false') where.isHomepageMerchant = false
    if (priorityMinParam) {
      const min = parseInt(priorityMinParam)
      if (!Number.isNaN(min)) where.displayPriority = { gte: min }
    }
    if (hasLiveOffersParam === 'true') {
      where.offers = { some: { status: 'LIVE', deletedAt: null } }
    }
    if (hasPendingOffersParam === 'true') {
      where.offers = {
        some: {
          status: { in: ['AWAITING_APPROVAL', 'PENDING_APPROVAL', 'VALIDATION_IN_PROGRESS'] },
          deletedAt: null,
        },
      }
    }
    if (q) {
      const matchingAccounts = await prisma.account.findMany({
        where: { email: { contains: q, mode: 'insensitive' }, profileType: 'MERCHANT' },
        select: { authUserId: true },
      })
      const accountAuthUserIds = matchingAccounts.map((a) => a.authUserId).filter(Boolean)
      where.OR = [
        { businessName: { contains: q, mode: 'insensitive' } },
        { contactName: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
      ]
      if (accountAuthUserIds.length > 0) {
        where.OR.push({ accountId: { in: accountAuthUserIds } })
      }
    }

    // ----- Sorting -----
    const orderBy: any[] = []
    if (sortBy === 'priority' || (VALID_SORTS as readonly string[]).includes(sortBy) === false) {
      orderBy.push({ displayPriority: sortDir })
    } else if (sortBy === 'createdAt') {
      orderBy.push({ createdAt: sortDir })
    } else if (sortBy === 'redemptions') {
      orderBy.push({ totalRedemptions: sortDir })
    } else if (sortBy === 'status') {
      orderBy.push({ status: sortDir })
    } else if (sortBy === 'lastActivity') {
      orderBy.push({ updatedAt: sortDir })
    }
    // Always tie-break with createdAt DESC
    orderBy.push({ createdAt: 'desc' })

    // ----- Find merchants (without heavy analytics yet) -----
    const [merchantsRaw, total] = await Promise.all([
      prisma.merchant.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          account: { select: { email: true } },
          _count: {
            select: {
              offers: true,
              branches: true,
              redemptions: true,
              issues: true,
            },
          },
        },
      }),
      prisma.merchant.count({ where }),
    ])

    const merchantIds = merchantsRaw.map((m) => m.id)
    if (merchantIds.length === 0) {
      const emptySummary: MerchantDashboardSummary = {
        totalMerchants: 0,
        pendingApproval: 0,
        featured: 0,
        homepageMerchants: 0,
        liveOffers: 0,
        pendingOffers: 0,
        todaysRedemptions: 0,
        thisMonthRedemptions: 0,
      }
      return NextResponse.json({
        success: true,
        data: [],
        summary: emptySummary,
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasNextPage: page * pageSize < total,
          hasPreviousPage: page > 1,
        },
      } satisfies MerchantDashboardResponse)
    }

    // ----- Batch analytics: offer stats by merchant -----
    const offerGroups = await prisma.merchantOffer.groupBy({
      by: ['merchantId', 'status'],
      where: { merchantId: { in: merchantIds }, deletedAt: null },
      _count: { _all: true },
    })
    const offerStatsByMerchant: Record<string, MerchantOfferStats> = {}
    for (const id of merchantIds) {
      offerStatsByMerchant[id] = {
        live: 0,
        pending: 0,
        archived: 0,
        rejected: 0,
        draft: 0,
        total: 0,
      }
    }
    for (const row of offerGroups) {
      const stats = offerStatsByMerchant[row.merchantId]
      if (!stats) continue
      const count = row._count._all
      stats.total += count
      switch (row.status) {
        case 'LIVE':
          stats.live += count
          break
        case 'AWAITING_APPROVAL':
        case 'PENDING_APPROVAL':
        case 'VALIDATION_IN_PROGRESS':
        case 'CHANGES_REQUESTED':
          stats.pending += count
          break
        case 'ARCHIVED':
        case 'REPLACED':
        case 'EXPIRED':
          stats.archived += count
          break
        case 'REJECTED':
        case 'VALIDATION_FAILED':
          stats.rejected += count
          break
        case 'DRAFT':
          stats.draft += count
          break
      }
    }

    // ----- Batch engagement: views + saves + redemptions per merchant -----
    const analyticsAgg = await prisma.offerAnalytics.groupBy({
      by: ['offerId'],
      _sum: { viewCount: true, saveCount: true },
      where: { offer: { merchantId: { in: merchantIds }, deletedAt: null } },
    })

    // Build a map: merchantId -> { views, saved }
    const engagementByMerchant: Record<string, { views: number; saved: number }> = {}
    for (const id of merchantIds) {
      engagementByMerchant[id] = { views: 0, saved: 0 }
    }
    if (analyticsAgg.length > 0) {
      // Need merchantId per offer
      const offerIds = analyticsAgg.map((a) => a.offerId)
      const offers = await prisma.merchantOffer.findMany({
        where: { id: { in: offerIds } },
        select: { id: true, merchantId: true },
      })
      const offerToMerchant = new Map(offers.map((o) => [o.id, o.merchantId]))
      for (const row of analyticsAgg) {
        const merchantId = offerToMerchant.get(row.offerId)
        if (!merchantId) continue
        const cur = engagementByMerchant[merchantId]
        if (!cur) continue
        cur.views += Number(row._sum.viewCount ?? 0)
        cur.saved += Number(row._sum.saveCount ?? 0)
      }
    }

    // ----- Batch: open issues count per merchant -----
    const openIssueGroups = await prisma.issueReport.groupBy({
      by: ['merchantId'],
      where: { merchantId: { in: merchantIds }, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      _count: { _all: true },
    })
    const openIssuesByMerchant: Record<string, number> = {}
    for (const id of merchantIds) openIssuesByMerchant[id] = 0
    for (const row of openIssueGroups) {
      const count = (row._count as any)._all ?? 0
      openIssuesByMerchant[row.merchantId] = count
    }

    // ----- Batch: company-employee relations per merchant (for redemptions) -----
    // Companies & employees can be derived from Redemption distinct counts
    const redemptionGroups = await prisma.redemption.groupBy({
      by: ['merchantId', 'companyId', 'employeeId'],
      where: { merchantId: { in: merchantIds } },
      _count: { _all: true },
    })
    const companiesByMerchant: Record<string, Set<string>> = {}
    const employeesByMerchant: Record<string, Set<string>> = {}
    for (const id of merchantIds) {
      companiesByMerchant[id] = new Set()
      employeesByMerchant[id] = new Set()
    }
    for (const row of redemptionGroups) {
      if (row.companyId) companiesByMerchant[row.merchantId]?.add(row.companyId)
      if (row.employeeId) employeesByMerchant[row.merchantId]?.add(row.employeeId)
    }

    // ----- Last activity (most recent of: offer.createdAt, offer.updatedAt, redemption.redeemedAt, merchant.updatedAt) -----
    const lastOfferPerMerchant = await prisma.merchantOffer.findMany({
      where: { merchantId: { in: merchantIds }, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: { merchantId: true, updatedAt: true, createdAt: true },
    })
    const lastOfferAtByMerchant: Record<string, Date | null> = {}
    for (const id of merchantIds) lastOfferAtByMerchant[id] = null
    for (const o of lastOfferPerMerchant) {
      const cur = lastOfferAtByMerchant[o.merchantId]
      const candidate = o.updatedAt
      if (!cur || candidate > cur) lastOfferAtByMerchant[o.merchantId] = candidate
    }
    const lastRedemptionAtByMerchant: Record<string, Date | null> = {}
    for (const id of merchantIds) lastRedemptionAtByMerchant[id] = null
    const lastRedemptions = await prisma.redemption.findMany({
      where: { merchantId: { in: merchantIds } },
      orderBy: { redeemedAt: 'desc' },
      select: { merchantId: true, redeemedAt: true },
      take: merchantIds.length * 3, // bound
    })
    for (const r of lastRedemptions) {
      const cur = lastRedemptionAtByMerchant[r.merchantId]
      if (!cur || r.redeemedAt > cur) lastRedemptionAtByMerchant[r.merchantId] = r.redeemedAt
    }

    // ----- Assemble rows -----
    const rows = merchantsRaw.map((m) => {
      const views = engagementByMerchant[m.id]?.views ?? 0
      const saved = engagementByMerchant[m.id]?.saved ?? 0
      const redeemed = m._count.redemptions
      const conversion = views > 0 ? (redeemed / views) * 100 : null

      const offerStats: MerchantOfferStats = offerStatsByMerchant[m.id] ?? {
        live: 0,
        pending: 0,
        archived: 0,
        rejected: 0,
        draft: 0,
        total: 0,
      }
      const engagement: MerchantEngagement = {
        views,
        saved,
        redeemed,
        conversion,
      }
      const relations: MerchantRelations = {
        companies: companiesByMerchant[m.id]?.size ?? 0,
        employees: employeesByMerchant[m.id]?.size ?? 0,
        branches: m._count.branches,
        issueReports: m._count.issues,
        openIssues: openIssuesByMerchant[m.id] ?? 0,
      }

      // Determine last activity: most recent of the candidates
      const candidates: Date[] = []
      const lastOffer = lastOfferAtByMerchant[m.id]
      const lastRedemption = lastRedemptionAtByMerchant[m.id]
      if (lastOffer) candidates.push(lastOffer)
      if (lastRedemption) candidates.push(lastRedemption)
      candidates.push(m.updatedAt)
      const lastActivityAt = candidates.length
        ? new Date(Math.max(...candidates.map((d) => d.getTime())))
        : m.updatedAt

      return toMerchantDashboardRow({
        ...m,
        offerStats,
        engagement,
        relations,
        lastActivityAt,
      })
    })

    // ----- Apply health filter post-hoc (cheap) -----
    let filteredRows = rows
    if (healthParam && healthParam !== 'ALL' && VALID_HEALTH.includes(healthParam as MerchantHealth)) {
      filteredRows = filteredRows.filter((r) => r.health === healthParam)
    }

    // ----- Summary metrics (global, not page-bounded) -----
    const todayStartDate = new Date(new Date().setHours(0, 0, 0, 0))
    const monthStartDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

    const [pendingApprovalCount, featuredCount, homepageCount, globalOfferStats, todayCount, monthCount] = await Promise.all([
      prisma.merchant.count({ where: { deletedAt: null, status: 'PENDING' } }),
      prisma.merchant.count({ where: { deletedAt: null, isFeatured: true } }),
      prisma.merchant.count({ where: { deletedAt: null, isHomepageMerchant: true } }),
      prisma.merchantOffer.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.redemption.count({ where: { redeemedAt: { gte: todayStartDate } } }),
      prisma.redemption.count({ where: { redeemedAt: { gte: monthStartDate } } }),
    ])

    const liveOffers = globalOfferStats
      .filter((g) => g.status === 'LIVE')
      .reduce((sum, g) => sum + g._count._all, 0)
    const pendingOffers = globalOfferStats
      .filter((g) => ['AWAITING_APPROVAL', 'PENDING_APPROVAL', 'VALIDATION_IN_PROGRESS', 'CHANGES_REQUESTED'].includes(g.status))
      .reduce((sum, g) => sum + g._count._all, 0)

    const summary: MerchantDashboardSummary = {
      totalMerchants: await prisma.merchant.count({ where: { deletedAt: null } }),
      pendingApproval: pendingApprovalCount,
      featured: featuredCount,
      homepageMerchants: homepageCount,
      liveOffers,
      pendingOffers,
      todaysRedemptions: todayCount,
      thisMonthRedemptions: monthCount,
    }

    return NextResponse.json({
      success: true,
      data: filteredRows,
      summary,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page * pageSize < total,
        hasPreviousPage: page > 1,
      },
    } satisfies MerchantDashboardResponse)
  } catch (error) {
    return internalError(error)
  }
}
