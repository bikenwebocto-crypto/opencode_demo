import { prisma } from '@/lib/prisma'
import { getCurrentUser, type CurrentUser } from '@/lib/supabase/server'

export async function getMerchantFromSession(user?: CurrentUser | null) {
  if (!user) {
    user = await getCurrentUser()
  }

  if (!user || user.userType !== "merchant" || !user.profileId) {
    return null
  }

  return prisma.merchant.findUnique({
    where: {
      id: user.profileId
    }
  })
}
