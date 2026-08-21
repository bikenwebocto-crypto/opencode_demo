import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { internalError } from '@/lib/employee-helpers'
import { getAuthenticatedMobileEmployee } from '@/lib/mobile-auth'
import { safeQuery } from '@/lib/prisma/safe-query'

// GET /api/mobile/categories
//
// Active global categories available to all employees. Returns the
// platform-wide category list so employees can filter/browse merchants
// across the full taxonomy regardless of which company they belong to.
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedMobileEmployee(request)
    if (!auth.ok) return auth.response

    const categories = await safeQuery(
      () =>
        prisma.category.findMany({
          where: { isActive: true },
          orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            icon: true,
          },
        }),
      [],
      { context: 'Category.findMany:mobile-active' },
    )

    return NextResponse.json({ success: true, data: categories })
  } catch (error) {
    return internalError(error)
  }
}
