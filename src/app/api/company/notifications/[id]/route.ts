import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyAdmin, handleApiError } from '../../helpers'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { companyAdmin } = await getCompanyAdmin()
    const { id } = await params

    const notification = await prisma.notificationEvent.findFirst({
      where: { id, companyAdminId: companyAdmin.id },
    })
    if (!notification) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } },
        { status: 404 },
      )
    }

    const updated = await prisma.notificationEvent.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return handleApiError(error)
  }
}
