import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'
import { forbidden } from '@/lib/api-auth'
import { getCityReadiness } from '@/lib/company-activation/city-readiness'

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 }
  )
}
function internalError(error: unknown) {
  console.error('City readiness error:', error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 }
  )
}
function notFound(message = 'Company not found') {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message } },
    { status: 404 }
  )
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    if (user.userType !== 'admin') return forbidden(user.userType)

    const { id } = await params
    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true, city: true, deletedAt: true },
    })
    if (!company || company.deletedAt) return notFound()

    const readiness = await getCityReadiness(company.city)
    return NextResponse.json({ success: true, data: readiness })
  } catch (error) {
    return internalError(error)
  }
}
