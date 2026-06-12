import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'
import { getMerchantFromSession } from '@/lib/merchant-session'
import {
  deriveStatus,
  decodeMethod,
  type RedemptionStatus,
  type RedemptionMethod,
} from '@/lib/redemption-status'

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
  console.error('Merchant redemptions API error:', error)
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

function endOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'merchant') return unauthorized()
    const merchant = await getMerchantFromSession()
    if (!merchant) return notFound()

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? '25')))
    const offerId = searchParams.get('offerId') ?? undefined
    const branchId = searchParams.get('branchId') ?? undefined
    const companyId = searchParams.get('companyId') ?? undefined
    const status = searchParams.get('status') ?? undefined
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const q = searchParams.get('q') ?? undefined

    const where: any = { merchantId: merchant.id }
    if (offerId) where.offerId = offerId
    if (branchId) where.branchId = branchId
    if (companyId) where.companyId = companyId
    if (from || to) {
      where.redeemedAt = {}
      if (from) where.redeemedAt.gte = startOfDay(new Date(from))
      if (to) where.redeemedAt.lte = endOfDay(new Date(to))
    }
    if (q) {
      where.OR = [
        { redemptionCode: { contains: q, mode: 'insensitive' } },
        { employee: { firstName: { contains: q, mode: 'insensitive' } } },
        { employee: { lastName: { contains: q, mode: 'insensitive' } } },
        { employee: { email: { contains: q, mode: 'insensitive' } } },
        { company: { name: { contains: q, mode: 'insensitive' } } },
      ]
    }

    const [rows, total, todayCount, weekCount, monthCount] = await Promise.all([
      prisma.redemption.findMany({
        where,
        orderBy: { redeemedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, email: true } },
          company: { select: { id: true, name: true } },
          offer: { select: { id: true, title: true, offerType: true, discountValue: true } },
        },
      }),
      prisma.redemption.count({ where }),
      prisma.redemption.count({
        where: {
          merchantId: merchant.id,
          redeemedAt: { gte: startOfDay(new Date()) },
        },
      }),
      prisma.redemption.count({
        where: {
          merchantId: merchant.id,
          redeemedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.redemption.count({
        where: {
          merchantId: merchant.id,
          redeemedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ])

    const branchIds = Array.from(new Set(rows.map((r) => r.branchId).filter((b): b is string => !!b)))
    const branchList = branchIds.length
      ? await prisma.merchantBranch.findMany({
          where: { id: { in: branchIds } },
          select: { id: true, name: true, branchType: true },
        })
      : []
    const branchMap = new Map(branchList.map((b) => [b.id, b]))

    const rowsWithBranch = rows.map((r) => ({
      ...r,
      branch: r.branchId ? branchMap.get(r.branchId) ?? null : null,
      status: deriveStatus(r) as RedemptionStatus,
      method: decodeMethod(r.merchantNotes) as RedemptionMethod | null,
    }))

    const offerAgg = await prisma.redemption.groupBy({
      by: ['offerId'],
      where: { merchantId: merchant.id },
      _count: { _all: true },
      _sum: { discountAmount: true, savingsAmount: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    })
    const topOfferIds = offerAgg.map((o) => o.offerId)
    const topOfferMeta = topOfferIds.length
      ? await prisma.merchantOffer.findMany({
          where: { id: { in: topOfferIds } },
          select: { id: true, title: true },
        })
      : []
    const topOfferMap = new Map(topOfferMeta.map((o) => [o.id, o.title]))
    const topOffers = offerAgg.map((o) => ({
      offerId: o.offerId,
      title: topOfferMap.get(o.offerId) ?? 'Unknown',
      redemptions: o._count._all,
      totalDiscount: Number(o._sum.discountAmount ?? 0),
      totalSavings: Number(o._sum.savingsAmount ?? 0),
    }))

    const branchAgg = await prisma.redemption.groupBy({
      by: ['branchId'],
      where: { merchantId: merchant.id, branchId: { not: null } },
      _count: { _all: true },
      _sum: { savingsAmount: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    })
    const topBranchIds = branchAgg.map((b) => b.branchId).filter((b): b is string => !!b)
    const topBranchMeta = topBranchIds.length
      ? await prisma.merchantBranch.findMany({
          where: { id: { in: topBranchIds } },
          select: { id: true, name: true },
        })
      : []
    const topBranchMap = new Map(topBranchMeta.map((b) => [b.id, b.name]))
    const topBranches = branchAgg.map((b) => ({
      branchId: b.branchId,
      name: b.branchId ? topBranchMap.get(b.branchId) ?? 'Unknown' : 'Online',
      redemptions: b._count._all,
      totalSavings: Number(b._sum.savingsAmount ?? 0),
    }))

    return NextResponse.json({
      success: true,
      data: rowsWithBranch,
      metrics: {
        today: todayCount,
        thisWeek: weekCount,
        thisMonth: monthCount,
        topOffer: topOffers[0] ?? null,
        topBranch: topBranches[0] ?? null,
      },
      topOffers,
      topBranches,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    return internalError(error)
  }
}
