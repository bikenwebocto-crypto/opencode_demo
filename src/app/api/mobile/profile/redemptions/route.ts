import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { internalError } from '@/lib/employee-helpers'
import { getAuthenticatedMobileEmployee } from '@/lib/mobile-auth'
import { deriveStatus } from '@/lib/redemption-status'

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedMobileEmployee(request)
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20')))

    const where = { employeeId: auth.employee.id }

    const [rows, total] = await Promise.all([
      prisma.redemption.findMany({
        where,
        orderBy: { redeemedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          redemptionCode: true,
          discountAmount: true,
          savingsAmount: true,
          isVerified: true,
          verifiedAt: true,
          redeemedAt: true,
          merchantNotes: true,
          employeeNotes: true,
          offer: {
            select: {
              id: true,
              title: true,
              content: { select: { imageUrls: true } },
            },
          },
          merchant: { select: { id: true, businessName: true, logoUrl: true } },
        },
      }),
      prisma.redemption.count({ where }),
    ])

    const items = rows.map((r) => ({
      id: r.id,
      redeemedAt: r.redeemedAt,
      savingsAmount: r.savingsAmount,
      redemptionCode: r.redemptionCode,
      isVerified: r.isVerified,
      status: deriveStatus(r),
      offer: {
        id: r.offer.id,
        title: r.offer.title,
        imageUrl: (r.offer.content?.imageUrls as string[] | null)?.[0] ?? null,
      },
      merchant: r.merchant,
    }))

    return NextResponse.json({
      success: true,
      items,
      pagination: {
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
