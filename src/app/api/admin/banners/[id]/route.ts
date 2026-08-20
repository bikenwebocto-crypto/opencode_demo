import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 }
  )
}

function notFound(entity: string) {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: `${entity} not found` } },
    { status: 404 }
  )
}

function internalError(error: unknown) {
  console.error('Admin banner update API error:', error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 }
  )
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'admin') return unauthorized()

    const { id } = await params
    const existing = await prisma.banner.findUnique({ where: { id } })
    if (!existing) return notFound('Banner')

    const body = await request.json()
    const allowedFields: string[] = ['name', 'description', 'position', 'pricePerDay', 'minDays', 'maxDays', 'isActive']
    const updates: Record<string, unknown> = {}

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = field === 'pricePerDay' ? parseFloat(body[field]) : body[field]
      }
    }

    const banner = await prisma.banner.update({
      where: { id },
      data: updates,
    })

    return NextResponse.json({ success: true, data: banner })
  } catch (error) {
    return internalError(error)
  }
}
