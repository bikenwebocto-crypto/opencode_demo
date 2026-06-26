import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/services/audit-log.service'
import { getCompanyAdmin, handleApiError } from '../../helpers'

export async function GET() {
  try {
    const { company, companyAdmin } = await getCompanyAdmin()

    const employees = await prisma.employee.findMany({
      where: { companyId: company.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        accountId: true,
        firstName: true,
        lastName: true,
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

    const empAccountIds = employees.map((e) => e.accountId).filter(Boolean) as string[]
    const empAccounts = empAccountIds.length > 0
      ? await prisma.account.findMany({ where: { authUserId: { in: empAccountIds } }, select: { authUserId: true, email: true } })
      : []
    const emailMap = new Map(empAccounts.map((a) => [a.authUserId, a.email]))

    const header = 'First Name,Last Name,Email,Department,Job Title,Employee ID,Status,Join Method,Created At,Last Login,Redemptions\n'
    const rows = employees.map((e) =>
      `"${e.firstName}","${e.lastName}","${emailMap.get(e.accountId ?? '') ?? ''}","${e.department ?? ''}","${e.jobTitle ?? ''}","${e.employeeId ?? ''}","${e.status}","${e.joinMethod ?? ''}","${e.createdAt.toISOString()}","${e.lastLoginAt?.toISOString() ?? ''}","${e._count.redemptions}"`,
    ).join('\n')
    const csv = header + rows

    await createAuditLog({
      actorType: 'company_admin',
      actorId: companyAdmin.id,
      action: 'EXPORT_GENERATED',
      entityType: 'EMPLOYEE',
      entityId: company.id,
      metadata: { exportedBy: companyAdmin.id, count: employees.length },
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
