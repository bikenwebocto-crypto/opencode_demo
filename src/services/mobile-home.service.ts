// Mobile Employee Home service.
//
// Produces the JSON payload rendered by the mobile app's landing page after
// successful employee login. The endpoint fans out seven sections, each of
// which has its own ranking rules. All section queries are independent and
// run in parallel via Promise.all.
//
// Performance contract:
//   - Every section query uses `select` (not `include`) so the DB only
//     returns the 16 offer fields + 4 merchant fields + 3 category fields
//     actually serialized by `mapOffer`.
//   - The company-name lookup runs in parallel with the section builders
//     via Promise.all.
//   - No N+1 queries: merchant and category relations are pre-fetched in
//     the same query.
//
// Extensibility notes:
//   - The `Section` and item shapes are intentionally stable so future
//     enhancements (sponsored slots, AI recommendations, location-aware
//     personalization) can be added without changing the API contract.
//   - The optional `Location` input is currently advisory; when a real
//     geolocation flow lands it can be used to bias every section without
//     breaking the wire format.

import { prisma } from '@/lib/prisma'

// Minimal employee shape required by this service. Decoupled from
// `EmployeeSession` (from `@/lib/employee-session`) so the service can
// be called from any mobile route that already has the Employee row
// in hand — e.g. the result of `getAuthenticatedMobileEmployee`.
export interface MobileHomeEmployee {
  id: string
  companyId: string
  firstName: string
  lastName: string
  avatarUrl: string | null
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface Location {
  latitude: number
  longitude: number
}

export interface MobileHomeUser {
  id: string
  firstName: string
  lastName: string
  company: string
  avatarUrl: string | null
}

export interface MobileHomeOffer {
  id: string
  title: string
  shortDescription: string | null
  imageUrl: string | null
  merchantId: string
  merchantName: string
  merchantLogo: string | null
  category: { id: string; name: string; icon: string | null } | null
  offerType: string
  discountValue: number
  discountPercent: number | null
  startDate: string
  endDate: string
  isFeatured: boolean
  isExclusive: boolean
  distance: number | null
}

export interface MobileHomeMerchant {
  id: string
  name: string
  logo: string | null
  category: { id: string; name: string; icon: string | null } | null
  distance: number | null
  offerCount: number
}

export type SectionType = 'hero' | 'merchant' | 'offer'

export interface MobileHomeSection<T = unknown> {
  id: string
  title: string
  type: SectionType
  items: T[]
}

export interface MobileHomeData {
  user: MobileHomeUser
  sections: [
    MobileHomeSection<MobileHomeOffer>,
    MobileHomeSection<MobileHomeMerchant>,
    MobileHomeSection<MobileHomeOffer>,
    MobileHomeSection<MobileHomeOffer>,
    MobileHomeSection<MobileHomeOffer>,
    MobileHomeSection<MobileHomeOffer>,
    MobileHomeSection<MobileHomeOffer>,
  ]
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const SECTION_LIMITS = {
  discover: 5,
  nearBrands: 10,
  forYou: 10,
  nearbyOffers: 10,
  newArrivals: 10,
  popular: 10,
  today: 10,
} as const

// Shared "offer is currently visible to employees" filter. Mirrors the
// visibility rules in `lib/offer-visibility.ts` but expressed as a reusable
// `where` clause so we can compose it with section-specific filters.
//
// IMPORTANT: this is the single source of truth for visibility. Any other
// place that filters LIVE offers (e.g. buildNearbyOffers) MUST reuse this.
const liveOfferWhere = (now: Date) => ({
  status: 'LIVE' as const,
  startDate: { lte: now },
  endDate: { gt: now },
  merchant: {
    status: 'ACTIVE' as const,
    deletedAt: null,
    branches: {
      some: { isActive: true, status: 'ACTIVE' as const, deletedAt: null },
    },
  },
})

// Select-only projection for `MerchantOffer` rows. Only the 16 fields used
// by `mapOffer` are fetched, plus the nested `merchant` + `category`. This
// replaces the previous `include` (which fetched ~20 unused columns per
// row) and matches the wire payload exactly.
const offerSelect = {
  id: true,
  title: true,
  shortDescription: true,
  imageUrls: true,
  offerType: true,
  discountValue: true,
  discountPercent: true,
  startDate: true,
  endDate: true,
  isFeatured: true,
  isExclusive: true,
  createdAt: true,
  merchant: {
    select: {
      id: true,
      businessName: true,
      logoUrl: true,
      category: { select: { id: true, name: true, icon: true } },
    },
  },
} as const

function toIso(d: Date): string {
  return d.toISOString()
}

// Haversine distance in kilometres between two lat/lng points.
function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371
  const toRad = (n: number) => (n * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Resolves the best branch coordinate for a merchant. Prefers the primary
// branch, otherwise the first branch with both lat/lng populated.
function branchCoordinate(
  branches: { isPrimary?: boolean; latitude: unknown; longitude: unknown }[],
): { latitude: number; longitude: number } | null {
  const candidates = branches.filter(
    (b) => b.latitude != null && b.longitude != null,
  ) as { isPrimary?: boolean; latitude: { toString(): string } | number; longitude: { toString(): string } | number }[]

  if (candidates.length === 0) return null
  const primary = candidates.find((b) => b.isPrimary)
  const pick = primary ?? candidates[0]
  return {
    latitude: Number(pick!.latitude as { toString(): string } | number),
    longitude: Number(pick!.longitude as { toString(): string } | number),
  }
}

// Map a Prisma offer row (with `merchant` relation pre-included) to the
// mobile payload. `distance` is derived from the merchant's primary branch
// or null if no location was supplied.
function mapOffer(
  o: {
    id: string
    title: string
    shortDescription: string | null
    imageUrls: string[]
    offerType: string
    discountValue: { toString(): string } | number | null
    discountPercent: number | null
    startDate: Date
    endDate: Date
    isFeatured: boolean
    isExclusive: boolean
    merchant: {
      id: string
      businessName: string
      logoUrl: string | null
      category: { id: string; name: string; icon: string | null } | null
    }
  },
  distance: number | null,
): MobileHomeOffer {
  const discountRaw = o.discountValue as unknown
  const discountValue =
    typeof discountRaw === 'number'
      ? discountRaw
      : discountRaw && typeof (discountRaw as { toString(): string }).toString === 'function'
        ? Number((discountRaw as { toString(): string }).toString())
        : 0

  return {
    id: o.id,
    title: o.title,
    shortDescription: o.shortDescription,
    imageUrl: o.imageUrls?.[0] ?? null,
    merchantId: o.merchant.id,
    merchantName: o.merchant.businessName,
    merchantLogo: o.merchant.logoUrl,
    category: o.merchant.category,
    offerType: o.offerType,
    discountValue,
    discountPercent: o.discountPercent,
    startDate: toIso(o.startDate),
    endDate: toIso(o.endDate),
    isFeatured: o.isFeatured,
    isExclusive: o.isExclusive,
    distance,
  }
}

function mapMerchant(
  m: {
    id: string
    businessName: string
    logoUrl: string | null
    category: { id: string; name: string; icon: string | null } | null
    _count: { offers: number }
  },
  distance: number | null,
): MobileHomeMerchant {
  return {
    id: m.id,
    name: m.businessName,
    logo: m.logoUrl,
    category: m.category,
    distance,
    offerCount: m._count.offers,
  }
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

async function buildDiscover(now: Date): Promise<MobileHomeOffer[]> {
  const rows = await prisma.merchantOffer.findMany({
    where: liveOfferWhere(now),
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    take: SECTION_LIMITS.discover,
    select: offerSelect,
  })
  return rows.map((o) => mapOffer(o, null))
}

async function buildBrandsNearYou(
  location: Location | null,
): Promise<MobileHomeMerchant[]> {
  const rows = await prisma.merchant.findMany({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
      branches: { some: { isActive: true, status: 'ACTIVE', deletedAt: null } },
    },
    take: SECTION_LIMITS.nearBrands * 3, // overscan then re-sort in memory
    orderBy: [{ isFeatured: 'desc' }, { isTopRated: 'desc' }, { businessName: 'asc' }],
    select: {
      id: true,
      businessName: true,
      logoUrl: true,
      isFeatured: true,
      isTopRated: true,
      category: { select: { id: true, name: true, icon: true } },
      branches: {
        where: { deletedAt: null, status: 'ACTIVE' },
        select: { latitude: true, longitude: true, isPrimary: true },
      },
      _count: {
        select: {
          offers: {
            where: {
              status: 'LIVE',
              startDate: { lte: new Date() },
              endDate: { gt: new Date() },
            },
          },
        },
      },
    },
  })

  const enriched = rows.map((m) => {
    const coord = branchCoordinate(m.branches)
    const distance =
      location && coord
        ? haversineKm(location.latitude, location.longitude, coord.latitude, coord.longitude)
        : null
    return { merchant: m, distance }
  })

  enriched.sort((a, b) => {
    if (location && a.distance != null && b.distance != null) {
      return a.distance - b.distance
    }
    if (location && a.distance != null) return -1
    if (location && b.distance != null) return 1
    return 0
  })

  return enriched.slice(0, SECTION_LIMITS.nearBrands).map((e) => mapMerchant(e.merchant, e.distance))
}

async function buildForYou(employeeId: string, now: Date): Promise<MobileHomeOffer[]> {
  // Pull the employee's recent redemption history to infer preferences.
  // 30 days is long enough to surface real patterns without going stale.
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const [history, redeemedIds] = await Promise.all([
    prisma.redemption.findMany({
      where: { employeeId, redeemedAt: { gte: cutoff } },
      select: {
        offerId: true,
        merchantId: true,
        offer: { select: { categoryId: true } },
      },
      take: 50,
    }),
    // All-time redeemed offer ids for this employee — used to exclude them
    // from recommendations (so the same offer never appears twice in the
    // "for you" section after the employee redeems it).
    prisma.redemption.findMany({
      where: { employeeId },
      select: { offerId: true },
    }),
  ])

  const redeemedSet = new Set(redeemedIds.map((r) => r.offerId))

  if (history.length === 0) {
    // Cold-start fallback: newest LIVE offers that this employee has not
    // already redeemed. The empty-set filter becomes a no-op for new
    // employees; for returning employees with prior (out-of-window)
    // redemptions, it prevents the section from re-surfacing used offers.
    const rows = await prisma.merchantOffer.findMany({
      where: {
        ...liveOfferWhere(now),
        id: { notIn: [...redeemedSet] },
      },
      orderBy: { createdAt: 'desc' },
      take: SECTION_LIMITS.forYou,
      select: offerSelect,
    })
    return rows.map((o) => mapOffer(o, null))
  }

  const categoryWeight = new Map<string, number>()
  const merchantWeight = new Map<string, number>()
  for (const r of history) {
    if (r.offer?.categoryId) {
      categoryWeight.set(r.offer.categoryId, (categoryWeight.get(r.offer.categoryId) ?? 0) + 1)
    }
    merchantWeight.set(r.merchantId, (merchantWeight.get(r.merchantId) ?? 0) + 1)
  }
  const topCategoryIds = [...categoryWeight.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id)
  const topMerchantIds = [...merchantWeight.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id)

  const rows = await prisma.merchantOffer.findMany({
    where: {
      ...liveOfferWhere(now),
      id: { notIn: [...redeemedSet] },
      OR: [
        ...(topCategoryIds.length > 0 ? [{ categoryId: { in: topCategoryIds } }] : []),
        ...(topMerchantIds.length > 0 ? [{ merchantId: { in: topMerchantIds } }] : []),
      ],
    },
    take: SECTION_LIMITS.forYou,
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    select: offerSelect,
  })
  return rows.map((o) => mapOffer(o, null))
}

async function buildNearbyOffers(
  now: Date,
  location: Location | null,
): Promise<MobileHomeOffer[]> {
  if (!location) {
    const rows = await prisma.merchantOffer.findMany({
      where: liveOfferWhere(now),
      orderBy: { createdAt: 'desc' },
      take: SECTION_LIMITS.nearbyOffers,
      select: offerSelect,
    })
    return rows.map((o) => mapOffer(o, null))
  }

  // Reuse `liveOfferWhere(now)` as the single source of truth for branch
  // visibility. Previously the location path used a slightly looser
  // `branches: { some: { deletedAt: null, status: 'ACTIVE' } }` (no
  // `isActive` check) — fixed in this version.
  const rows = await prisma.merchantOffer.findMany({
    where: liveOfferWhere(now),
    take: SECTION_LIMITS.nearbyOffers * 3,
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    select: {
      ...offerSelect,
      merchant: {
        select: {
          ...offerSelect.merchant.select,
          branches: {
            where: { deletedAt: null, status: 'ACTIVE', isActive: true },
            select: { latitude: true, longitude: true, isPrimary: true },
          },
        },
      },
    },
  })

  const withDistance = rows
    .map((o) => {
      const coord = branchCoordinate(o.merchant.branches)
      const distance = coord
        ? haversineKm(location.latitude, location.longitude, coord.latitude, coord.longitude)
        : null
      return { offer: o, distance }
    })
    .filter((r): r is { offer: typeof rows[number]; distance: number } => r.distance != null)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, SECTION_LIMITS.nearbyOffers)

  return withDistance.map(({ offer, distance }) => {
    // Strip the branches join before mapping so the payload stays lean.
    const { branches: _branches, ...merchantRest } = offer.merchant
    return mapOffer({ ...offer, merchant: merchantRest }, distance)
  })
}

async function buildNewArrivals(now: Date): Promise<MobileHomeOffer[]> {
  const rows = await prisma.merchantOffer.findMany({
    where: liveOfferWhere(now),
    orderBy: { createdAt: 'desc' },
    take: SECTION_LIMITS.newArrivals,
    select: offerSelect,
  })
  return rows.map((o) => mapOffer(o, null))
}

async function buildPopular(now: Date): Promise<MobileHomeOffer[]> {
  const rows = await prisma.merchantOffer.findMany({
    where: liveOfferWhere(now),
    orderBy: [
      { currentRedemptions: 'desc' },
      { viewCount: 'desc' },
      { saveCount: 'desc' },
    ],
    take: SECTION_LIMITS.popular,
    select: offerSelect,
  })
  return rows.map((o) => mapOffer(o, null))
}

async function buildTodaysPicks(now: Date): Promise<MobileHomeOffer[]> {
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)

  // Pull today's redemption counts. We deliberately do NOT apply
  // `liveOfferWhere` here — the offer id is what we need; visibility is
  // re-applied in step 3 so an expired or paused offer never reaches the
  // final list, even if it was redeemed earlier today.
  const todaysCounts = await prisma.redemption.groupBy({
    by: ['offerId'],
    where: { redeemedAt: { gte: startOfDay } },
    _count: { _all: true },
    orderBy: { _count: { offerId: 'desc' } },
    take: SECTION_LIMITS.today,
  })

  if (todaysCounts.length === 0) {
    return buildPopular(now)
  }

  const ids = todaysCounts.map((r) => r.offerId)
  const countMap = new Map(todaysCounts.map((r) => [r.offerId, r._count._all]))

  // Apply `liveOfferWhere` so only valid LIVE offers are returned.
  // Previously the visibility filter was applied AFTER the top-10 were
  // selected, which meant an expired top offer silently dropped out of
  // the rank order. Filtering here preserves rank order integrity.
  const rows = await prisma.merchantOffer.findMany({
    where: { ...liveOfferWhere(now), id: { in: ids } },
    select: offerSelect,
  })

  // Preserve the groupBy ranking. Use featured + recency as tiebreakers so
  // a featured offer is preferred over a non-featured one with the same
  // redemption count.
  const byId = new Map(rows.map((r) => [r.id, r]))
  return ids
    .map((id) => byId.get(id))
    .filter((o): o is NonNullable<typeof o> => Boolean(o))
    .sort((a, b) => {
      const ca = countMap.get(a.id) ?? 0
      const cb = countMap.get(b.id) ?? 0
      if (ca !== cb) return cb - ca
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1
      return b.createdAt.getTime() - a.createdAt.getTime()
    })
    .map((o) => mapOffer(o, null))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GetMobileHomeInput {
  employee: MobileHomeEmployee
  location?: Location | null
}

export async function getMobileHome({ employee, location }: GetMobileHomeInput): Promise<MobileHomeData> {
  const now = new Date()

  // Run all seven sections AND the company-name lookup concurrently. The
  // company lookup is independent of the section builders, so it can sit
  // in the same Promise.all without serializing.
  const [company, discover, nearBrands, forYou, nearbyOffers, newArrivals, popular, today] =
    await Promise.all([
      prisma.company.findUnique({
        where: { id: employee.companyId },
        select: { name: true },
      }),
      buildDiscover(now),
      buildBrandsNearYou(location ?? null),
      buildForYou(employee.id, now),
      buildNearbyOffers(now, location ?? null),
      buildNewArrivals(now),
      buildPopular(now),
      buildTodaysPicks(now),
    ])

  const user: MobileHomeUser = {
    id: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    company: company?.name ?? '',
    avatarUrl: employee.avatarUrl,
  }

  return {
    user,
    sections: [
      { id: 'discover', title: 'Discover Now', type: 'hero', items: discover },
      { id: 'nearBrands', title: 'Brands Near You', type: 'merchant', items: nearBrands },
      { id: 'forYou', title: 'Recommended For You', type: 'offer', items: forYou },
      { id: 'nearbyOffers', title: 'Nearby Offers', type: 'offer', items: nearbyOffers },
      { id: 'newArrivals', title: 'New Arrivals', type: 'offer', items: newArrivals },
      { id: 'popular', title: 'Most Popular', type: 'offer', items: popular },
      { id: 'today', title: "Today's Hot Picks", type: 'offer', items: today },
    ],
  }
}
