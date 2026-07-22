import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEmployeeFromSession, unauthorized, internalError, companyInactive, notFound, badRequest } from '@/lib/employee-session'

/**
 * Compute the live "is this offer visible/redeemable" status for a
 * single offer. Inlined here so the list endpoint can return
 * `isVisible` + `visibilityReason` without a second round-trip.
 *
 * The same rules live in `src/lib/offer-visibility.ts`; this is a
 * batch-friendly variant that takes the already-loaded offer +
 * branches payload (no second Prisma call).
 */
interface VisibilityInput {
  status: string
  startDate: Date
  endDate: Date
  deletedAt: Date | null
  merchant: {
    status: string
    deletedAt: Date | null
    branches: { isActive: boolean; status: string; branchType: string }[]
  }
}

function evaluateVisibility(o: VisibilityInput, now: Date): { visible: boolean; reason?: string } {
  if (o.status !== 'LIVE') return { visible: false, reason: 'Offer is not live' }
  if (o.startDate > now) return { visible: false, reason: 'Offer has not started yet' }
  if (o.endDate <= now) return { visible: false, reason: 'Offer has expired' }
  if (o.merchant.status !== 'ACTIVE') return { visible: false, reason: 'Merchant is not active' }
  if (o.merchant.deletedAt) return { visible: false, reason: 'Merchant no longer exists' }
  const hasActiveBranch = o.merchant.branches.some((b) => b.isActive && b.status === 'ACTIVE')
  const hasOnlineBranch = o.merchant.branches.some(
    (b) => b.branchType === 'ONLINE' && b.status === 'ACTIVE',
  )
  if (!hasActiveBranch && !hasOnlineBranch) {
    return { visible: false, reason: 'Merchant has no active branches' }
  }
  return { visible: true }
}

export async function GET(request: NextRequest) {
  try {
    const employee = await getEmployeeFromSession()
    if (!employee) return unauthorized()
    if ('inactive' in employee) return companyInactive(employee.companyStatus)

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') ?? undefined
    const categoryId = searchParams.get('categoryId') ?? undefined
    const featured = searchParams.get('featured') === 'true'
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') ?? '20')))

    const now = new Date()
    const where: any = {
      status: 'LIVE',
      startDate: { lte: now },
      endDate: { gt: now },
      merchant: {
        status: 'ACTIVE',
        deletedAt: null,
        branches: { some: { isActive: true, status: 'ACTIVE', deletedAt: null } },
      },
    }
    if (categoryId) where.categoryId = categoryId
    if (featured) where.isFeatured = true
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { description: { contains: q, mode: 'insensitive' } } },
        { merchant: { businessName: { contains: q, mode: 'insensitive' } } },
      ]
    }

    const [rows, total] = await Promise.all([
      prisma.merchantOffer.findMany({
        where,
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          offerType: true,
          isFeatured: true,
          isExclusive: true,
          endDate: true,
          startDate: true,
          status: true,
          deletedAt: true,
          content: {
            select: {
              description: true,
              shortDescription: true,
              termsAndConditions: true,
              imageUrls: true,
            },
          },
          pricing: {
            select: {
              configuration: true,
            },
          },
          redemption: {
            select: {
              redemptionType: true,
              configuration: true,
              maxRedemptions: true,
              currentRedemptions: true,
              daysOfWeek: true,
            },
          },
          merchant: {
            select: {
              id: true,
              businessName: true,
              logoUrl: true,
              averageRating: true,
              city: true,
              state: true,
              status: true,
              deletedAt: true,
              description: true,
              category: { select: { id: true, name: true, icon: true } },
              branches: {
                where: { deletedAt: null, status: 'ACTIVE' },
                select: {
                  id: true,
                  name: true,
                  branchType: true,
                  isActive: true,
                  status: true,
                  addressLine1: true,
                  city: true,
                  state: true,
                },
                orderBy: { isPrimary: 'desc' },
              },
            },
          },
        },
      }),
      prisma.merchantOffer.count({ where }),
    ])

    const offerIds = rows.map((o) => o.id)
    const [saved, redeemed] = await Promise.all([
      offerIds.length
        ? prisma.notificationEvent.findMany({
            where: {
              employeeId: employee.id,
              referenceType: 'saved_offer',
              referenceId: { in: offerIds },
            },
            select: { referenceId: true },
          })
        : Promise.resolve([]),
      offerIds.length
        ? prisma.redemption.findMany({
            where: { employeeId: employee.id, offerId: { in: offerIds } },
            select: { offerId: true },
          })
        : Promise.resolve([]),
    ])
    const savedSet = new Set(saved.map((s) => s.referenceId))
    const redeemedSet = new Set(redeemed.map((r) => r.offerId))

    const data = rows.map((o) => {
      const pricingConfig = (o.pricing?.configuration as Record<string, unknown>) ?? {}
      const redemptionConfig = (o.redemption?.configuration as Record<string, unknown>) ?? {}
      const visibility = evaluateVisibility(
        {
          status: o.status,
          startDate: o.startDate,
          endDate: o.endDate,
          deletedAt: o.deletedAt,
          merchant: o.merchant,
        },
        now,
      )
      return {
        id: o.id,
        title: o.title,
        description: o.content?.description ?? null,
        shortDescription: o.content?.shortDescription ?? null,
        termsAndConditions: o.content?.termsAndConditions ?? null,
        imageUrls: o.content?.imageUrls ?? [],
        offerType: o.offerType,
        discountValue:
          pricingConfig.discountValue ?? pricingConfig.amount ?? pricingConfig.percent ?? null,
        discountPercent: (pricingConfig.percent as number | null) ?? null,
        discountMax: (pricingConfig.maximumDiscount as number | null) ?? null,
        minimumSpend: (pricingConfig.minimumSpend as number | null) ?? null,
        redemptionType: o.redemption?.redemptionType ?? null,
        redemptionInstructions: (redemptionConfig.instructions as string | null) ?? null,
        offerCode: (redemptionConfig.code as string | null) ?? null,
        bookingUrl: (redemptionConfig.bookingUrl as string | null) ?? null,
        qrCodeUrl: (redemptionConfig.qrCodeUrl as string | null) ?? null,
        daysOfWeek: o.redemption?.daysOfWeek ?? null,
        maxRedemptions: o.redemption?.maxRedemptions ?? null,
        currentRedemptions: o.redemption?.currentRedemptions ?? 0,
        isFeatured: o.isFeatured,
        isExclusive: o.isExclusive,
        endDate: o.endDate.toISOString(),
        startDate: o.startDate.toISOString(),
        merchant: o.merchant,
        isVisible: visibility.visible,
        visibilityReason: visibility.reason,
        isSaved: savedSet.has(o.id),
        isRedeemed: redeemedSet.has(o.id),
      }
    })

    return NextResponse.json({
      success: true,
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return internalError(error)
  }
}
