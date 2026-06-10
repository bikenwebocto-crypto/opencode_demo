import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'

export async function getMerchantFromSession() {
  const user = await getCurrentUser()
  if (!user || user.userType !== 'merchant' || !user.profileId) return null
  return prisma.merchant.findUnique({ where: { id: user.profileId } })
}
