import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { getMerchantFromSession } from '@/lib/merchant-session'

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 }
  )
}
function notFound() {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } },
    { status: 404 }
  )
}
function internalError(error: unknown) {
  console.error('Merchant analytics summary API error:', error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 }
  )
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'merchant') return unauthorized()
    const merchant = await getMerchantFromSession()
    if (!merchant) return notFound()

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const dateFrom = from ? startOfDay(new Date(from)) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const dateTo = to ? new Date(new Date(to).setHours(23, 59, 59, 999)) : new Date()

    const where = {
      merchantId: merchant.id,
      redeemedAt: { gte: dateFrom, lte: dateTo },
    }

    const [redemptionAgg, offerAgg, branchList, branchRedemptionCounts, trend, totals, liveOffers] = await Promise.all([
      prisma.redemption.aggregate({
        where,
        _count: { _all: true },
        _sum: { discountAmount: true, savingsAmount: true },
      }),
      prisma.merchantOffer.findMany({
        where: { merchantId: merchant.id, status: { in: ['LIVE', 'EXPIRED', 'ARCHIVED', 'REPLACED'] } },
        select: {
          id: true,
          title: true,
          status: true,
          viewCount: true,
          saveCount: true,
          _count: { select: { redemptions: true } },
        },
        orderBy: { viewCount: 'desc' },
        take: 5,
      }),
      prisma.merchantBranch.findMany({
        where: { merchantId: merchant.id, deletedAt: null },
        select: { id: true, name: true, branchType: true },
      }),
      prisma.redemption.groupBy({
        by: ['branchId'],
        where,
        _count: { _all: true },
      }),
      prisma.$queryRaw<{ date: string; total: number }[]>`
        SELECT DATE("redeemedAt") as date, COUNT(*)::int as total
        FROM "Redemption"
        WHERE "merchantId" = ${merchant.id}::uuid
          AND "redeemedAt" >= ${dateFrom} AND "redeemedAt" <= ${dateTo}
        GROUP BY DATE("redeemedAt")
        ORDER BY DATE("redeemedAt") ASC
      `.catch(() => [] as { date: string; total: number }[]),
      prisma.redemption.aggregate({
        where: { merchantId: merchant.id },
        _count: { _all: true },
        _sum: { savingsAmount: true },
      }),
      prisma.merchantOffer.count({
        where: { merchantId: merchant.id, status: 'LIVE' },
      }),
    ])

    const branchCountMap = new Map(branchRedemptionCounts.map((b) => [b.branchId ?? 'online', b._count._all]))

    const topOffers = offerAgg
      .map((o) => ({
        id: o.id,
        title: o.title,
        status: o.status,
        views: o.viewCount,
        saves: o.saveCount,
        redemptions: o._count.redemptions,
        conversionRate: o.viewCount > 0 ? Number(((o._count.redemptions / o.viewCount) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.redemptions - a.redemptions)
      .slice(0, 5)

    const branchPerformance = branchList
      .map((b) => ({
        id: b.id,
        name: b.name,
        type: b.branchType,
        redemptions: branchCountMap.get(b.id) ?? 0,
      }))
      .sort((a, b) => b.redemptions - a.redemptions)

    return NextResponse.json({
      success: true,
      data: {
        period: { from: dateFrom, to: dateTo },
        summary: {
          totalRedemptions: redemptionAgg._count._all,
          totalDiscount: Number(redemptionAgg._sum.discountAmount ?? 0),
          totalSavings: Number(redemptionAgg._sum.savingsAmount ?? 0),
          allTimeRedemptions: totals._count._all,
          allTimeSavings: Number(totals._sum.savingsAmount ?? 0),
          liveOffers,
        },
        topOffers,
        branchPerformance,
        redemptionTrend: trend,
      },
    })
  } catch (error) {
    return internalError(error)
  }
}
