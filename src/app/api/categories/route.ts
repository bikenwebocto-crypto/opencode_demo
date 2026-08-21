import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeQuery } from '@/lib/prisma/safe-query'

export async function GET() {
  try {
    const categories = await safeQuery(
      () =>
        prisma.category.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            icon: true,
          },
        }),
      [],
      { context: 'Category.findMany:public-active' },
    )

    return NextResponse.json({ success: true, data: categories })
  } catch (error) {
    console.error('Categories fetch error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Failed to fetch categories' } },
      { status: 500 },
    )
  }
}
