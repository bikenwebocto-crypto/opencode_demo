import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { internalError } from '@/lib/employee-helpers'
import { getAuthenticatedMobileEmployee } from '@/lib/mobile-auth'

// GET /api/mobile/categories
//
// Active categories scoped to the employee's company. Mirrors the web
// `/api/categories` query but enforces Bearer-token auth via the shared
// `getAuthenticatedMobileEmployee` helper. Categories are company-scoped
// in the Prisma schema, so the employee only ever sees the categories
// their company has defined.
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedMobileEmployee(request)
    if (!auth.ok) return auth.response

    const categories = await prisma.category.findMany({
      where: {
        companyId: auth.employee.companyId,
        isActive: true,
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
      },
    })

    return NextResponse.json({ success: true, data: categories })
  } catch (error) {
    return internalError(error)
  }
}
