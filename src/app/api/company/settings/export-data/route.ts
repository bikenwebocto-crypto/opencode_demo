import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyAdmin, handleApiError } from '../../helpers'

export async function POST() {
  try {
    const { company, companyAdmin } = await getCompanyAdmin()

    const [employees, billing, redemptions] = await Promise.all([
      prisma.employee.findMany({
        where: { companyId: company.id, deletedAt: null },
        select: { firstName: true, lastName: true, email: true, department: true, status: true, createdAt: true },
      }),
      prisma.companyBilling.findUnique({ where: { companyId: company.id } }),
      prisma.redemption.findMany({
        where: { companyId: company.id },
        select: { id: true, redeemedAt: true, discountAmount: true, merchant: { select: { businessName: true } } },
        take: 1000,
        orderBy: { redeemedAt: 'desc' },
      }),
    ])

    const exportData = {
      company: {
        name: company.name,
        email: company.email,
        slug: company.slug,
        status: company.status,
        createdAt: company.createdAt,
      },
      billing: billing ? {
        plan: billing.plan,
        billingCycle: billing.billingCycle,
        pricePerEmployee: Number(billing.pricePerEmployee),
        billingStatus: billing.billingStatus,
        renewalDate: billing.renewalDate,
        totalPaid: Number(billing.totalPaid),
      } : null,
      statistics: {
        totalEmployees: employees.length,
        activeEmployees: employees.filter((e) => e.status === 'ACTIVE').length,
        totalRedemptions: redemptions.length,
      },
      employees,
      recentRedemptions: redemptions,
      exportedAt: new Date().toISOString(),
    }

    await prisma.auditLog.create({
      data: {
        actorType: 'COMPANY_ADMIN',
        companyId: company.id,
        action: 'EXPORT_GENERATED',
        entityType: 'COMPANY',
        entityId: company.id,
        metadata: { exportedBy: companyAdmin.id },
      },
    })

    return NextResponse.json({
      success: true,
      data: exportData,
      message: 'Company data exported successfully',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
