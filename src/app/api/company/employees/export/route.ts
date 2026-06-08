import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyAdmin, handleApiError } from '../../helpers'

export async function GET() {
  try {
    const { company, companyAdmin } = await getCompanyAdmin()

    const employees = await prisma.employee.findMany({
      where: { companyId: company.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        department: true,
        jobTitle: true,
        employeeId: true,
        status: true,
        joinMethod: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { redemptions: true } },
      },
    })

    const header = 'First Name,Last Name,Email,Department,Job Title,Employee ID,Status,Join Method,Created At,Last Login,Redemptions\n'
    const rows = employees.map((e) =>
      `"${e.firstName}","${e.lastName}","${e.email}","${e.department ?? ''}","${e.jobTitle ?? ''}","${e.employeeId ?? ''}","${e.status}","${e.joinMethod ?? ''}","${e.createdAt.toISOString()}","${e.lastLoginAt?.toISOString() ?? ''}","${e._count.redemptions}"`,
    ).join('\n')
    const csv = header + rows

    await prisma.auditLog.create({
      data: {
        actorType: 'COMPANY_ADMIN',
        companyId: company.id,
        action: 'EXPORT_GENERATED',
        entityType: 'EMPLOYEE',
        entityId: company.id,
        metadata: { exportedBy: companyAdmin.id, count: employees.length },
      },
    })

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="employees-${company.slug}-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
