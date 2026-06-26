import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'
import { forbidden } from '@/lib/api-auth'
import { buildPreview } from '@/lib/company-activation/employee-csv'

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 }
  )
}
function notFound(message = 'Company not found') {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message } },
    { status: 404 }
  )
}
function badRequest(message: string) {
  return NextResponse.json(
    { success: false, error: { code: 'VALIDATION', message } },
    { status: 400 }
  )
}
function internalError(error: unknown) {
  console.error('CSV preview error:', error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 }
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    if (user.userType !== 'admin') return forbidden(user.userType)

    const { id } = await params
    const company = await prisma.company.findUnique({ where: { id }, select: { id: true, deletedAt: true } })
    if (!company || company.deletedAt) return notFound()

    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof Blob)) {
      return badRequest('CSV file is required (multipart field "file")')
    }
    const csv = await (file as File).text()
    if (!csv.trim()) return badRequest('CSV file is empty')

    const preview = await buildPreview(csv, id)
    return NextResponse.json({ success: true, data: preview })
  } catch (error) {
    return internalError(error)
  }
}
