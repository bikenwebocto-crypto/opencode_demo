import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/services/audit-log.service'
import { getEmployeeFromSession, unauthorized, internalError, companyInactive, notFound, badRequest } from '@/lib/employee-session'
import {
  checkRedemptionEligibility,
  generateRedemptionCode,
} from '@/lib/offer-visibility'
import {
  encodeMethod,
  deriveStatus,
  REDEMPTION_METHODS,
  type RedemptionMethod,
} from '@/lib/redemption-status'

export async function GET(request: NextRequest) {
  try {
    const employee = await getEmployeeFromSession()
    if (!employee) return unauthorized()
    if ('inactive' in employee) return companyInactive(employee.companyStatus)
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? undefined

    const where: any = { employeeId: employee.id }
    if (status) {
      if (status === 'PENDING') {
        where.isVerified = false
        where.merchantNotes = { not: { startsWith: 'REJECTED:' } }
        where.employeeNotes = { not: { startsWith: 'CANCELLED:' } }
      } else if (status === 'CONFIRMED') {
        where.isVerified = true
      } else if (status === 'REJECTED') {
        where.merchantNotes = { startsWith: 'REJECTED:' }
      } else if (status === 'CANCELLED') {
        where.employeeNotes = { startsWith: 'CANCELLED:' }
      }
    }

    const rows = await prisma.redemption.findMany({
      where,
      orderBy: { redeemedAt: 'desc' },
      take: 100,
      include: {
        offer: { select: { id: true, title: true, offerType: true, discountValue: true } },
        merchant: { select: { id: true, businessName: true, logoUrl: true } },
        company: { select: { id: true, name: true } },
      },
    })

    const branchIds = Array.from(new Set(rows.map((r) => r.branchId).filter((b): b is string => !!b)))
    const branchList = branchIds.length
      ? await prisma.merchantBranch.findMany({
          where: { id: { in: branchIds } },
          select: { id: true, name: true, branchType: true },
        })
      : []
    const branchMap = new Map(branchList.map((b) => [b.id, b]))

    const data = rows.map((r) => ({
      ...r,
      branch: r.branchId ? branchMap.get(r.branchId) ?? null : null,
      status: deriveStatus(r),
      method: ((): RedemptionMethod | null => {
        const m = r.merchantNotes?.match(/^METHOD:(\w+)/)
        return (m?.[1] as RedemptionMethod) ?? null
      })(),
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return internalError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const employee = await getEmployeeFromSession()
    if (!employee) return unauthorized()
    if ('inactive' in employee) return companyInactive(employee.companyStatus)
    const body = await request.json()
    const { offerId, method, branchId, notes, spentAmount } = body

    if (!offerId) return badRequest('offerId is required')
    if (!method || !REDEMPTION_METHODS.includes(method)) {
      return badRequest(`method must be one of: ${REDEMPTION_METHODS.join(', ')}`)
    }

    const eligibility = await checkRedemptionEligibility(offerId, employee.id)
    if (!eligibility.eligible) {
      return badRequest(eligibility.reason ?? 'Not eligible to redeem this offer')
    }

    const offer = await prisma.merchantOffer.findUnique({ where: { id: offerId } })
    if (!offer) return notFound('Offer not found')

    let validBranchId: string | null = null
    if (branchId) {
      const branch = await prisma.merchantBranch.findFirst({
        where: { id: branchId, merchantId: offer.merchantId, deletedAt: null },
      })
      if (!branch) return badRequest('Invalid branchId for this offer')
      validBranchId = branch.id
    }

    const redemptionCode = generateRedemptionCode()
    const discountAmount = Number(offer.discountValue ?? 0)
    const spent = spentAmount ? Number(spentAmount) : 0
    const savings = method === 'IN_STORE' ? discountAmount : Math.max(0, discountAmount - spent)

    const redemption = await prisma.redemption.create({
      data: {
        merchantId: offer.merchantId,
        offerId: offer.id,
        employeeId: employee.id,
        companyId: employee.companyId,
        redemptionCode,
        discountAmount,
        spentAmount: spent || null,
        savingsAmount: savings,
        branchId: validBranchId,
        merchantNotes: encodeMethod(method),
        employeeNotes: notes ?? null,
        isVerified: false,
        redeemedAt: new Date(),
      },
    })

    await prisma.merchantOffer.update({
      where: { id: offerId },
      data: {
        currentRedemptions: { increment: 1 },
        viewCount: { increment: 0 },
      },
    })

    await createAuditLog({
      actorType: 'employee',
      actorId: employee.id,
      action: 'REDEMPTION_CREATED',
      entityType: 'redemption',
      entityId: redemption.id,
      metadata: { offerId, merchantId: offer.merchantId, method, branchId: validBranchId },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: redemption.id,
          redemptionCode: redemption.redemptionCode,
          method,
          status: 'PENDING',
          message: 'Redemption submitted. Show this code to the merchant.',
        },
      },
      { status: 201 }
    )
  } catch (error) {
    return internalError(error)
  }
}
