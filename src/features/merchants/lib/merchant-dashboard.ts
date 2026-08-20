import type {
  MerchantDashboardRow,
  MerchantEngagement,
  MerchantHealth,
  MerchantOfferStats,
  MerchantRelations,
} from '@/types'

export type { MerchantOfferStats, MerchantEngagement, MerchantRelations }

interface RawMerchant {
  id: string
  businessName: string
  slug: string
  contactName: string
  contactPhone: string | null
  logoUrl: string | null
  city: string | null
  state: string | null
  category: { id: string; name: string; slug: string } | null
  status: string
  isFeatured: boolean
  isHomepageMerchant: boolean
  isTopRated: boolean
  displayPriority: number
  averageRating: any
  totalRedemptions: number
  createdAt: Date
  updatedAt: Date
  liveAt: Date | null
  account?: { email: string | null } | null
  _count: {
    offers: number
    branches: number
    redemptions: number
    issues: number
  }
  offerStats: MerchantOfferStats
  engagement: MerchantEngagement
  relations: MerchantRelations
  lastActivityAt: Date | null
}

/**
 * Compute the merchant's overall health status.
 * Healthy: no pending issues AND has live offers AND no rejected offers
 * Critical: suspended OR high rejection OR no activity
 * Warning: no live offers OR many expired offers OR pending issues
 */
export function computeMerchantHealth(args: {
  status: string
  stats: MerchantOfferStats
  relations: MerchantRelations
  lastActivityAt: Date | null
  createdAt: Date
}): MerchantHealth {
  const { status, stats, relations, lastActivityAt, createdAt } = args

  // CRITICAL conditions
  if (status === 'SUSPENDED') return 'CRITICAL'
  if (status === 'REJECTED') return 'CRITICAL'
  if (stats.rejected > 5) return 'CRITICAL'

  // No activity in 60 days
  if (lastActivityAt) {
    const days = (Date.now() - new Date(lastActivityAt).getTime()) / (1000 * 60 * 60 * 24)
    if (days > 60) return 'CRITICAL'
  } else {
    const days = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
    if (days > 90) return 'CRITICAL'
  }

  // WARNING conditions
  if (relations.openIssues > 0) return 'WARNING'
  if (stats.live === 0 && status === 'ACTIVE') return 'WARNING'
  if (stats.rejected >= 2) return 'WARNING'
  if (stats.archived > 10) return 'WARNING'

  // HEALTHY
  if (status === 'ACTIVE' && stats.live > 0 && relations.openIssues === 0) {
    return 'HEALTHY'
  }

  // Default
  return status === 'ACTIVE' ? 'HEALTHY' : 'WARNING'
}

/**
 * Map a raw Prisma merchant (with all joins already done) to a dashboard row.
 */
export function toMerchantDashboardRow(m: RawMerchant): MerchantDashboardRow {
  const stats = m.offerStats
  const engagement = m.engagement
  const relations = m.relations
  const lastActivityAt = m.lastActivityAt ?? null

  return {
    id: m.id,
    businessName: m.businessName,
    slug: m.slug,
    email: m.account?.email ?? null,
    contactName: m.contactName,
    contactPhone: m.contactPhone,
    logoUrl: m.logoUrl,
    city: m.city,
    state: m.state,
    category: m.category,
    status: m.status as any,
    isFeatured: m.isFeatured,
    isHomepageMerchant: m.isHomepageMerchant,
    isTopRated: m.isTopRated,
    displayPriority: m.displayPriority,
    averageRating: Number(m.averageRating ?? 0),
    totalRedemptions: m.totalRedemptions ?? 0,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    liveAt: m.liveAt ? m.liveAt.toISOString() : null,
    lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
    stats,
    engagement,
    relations,
    health: computeMerchantHealth({
      status: m.status,
      stats,
      relations,
      lastActivityAt,
      createdAt: m.createdAt,
    }),
  }
}
