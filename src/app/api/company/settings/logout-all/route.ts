import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCompanyAdmin, handleApiError } from '../../helpers'

export async function POST() {
  try {
    const { companyAdmin } = await getCompanyAdmin()

    await prisma.loginSession.updateMany({
      where: { companyAdminId: companyAdmin.id, isActive: true },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true, message: 'Logged out of all devices' })
  } catch (error) {
    return handleApiError(error)
  }
}
