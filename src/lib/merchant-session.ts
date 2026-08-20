import { getCurrentUser, type CurrentUser } from '@/lib/supabase/server'
import type { Merchant } from '@prisma/client'

export async function getMerchantFromSession(user?: CurrentUser | null): Promise<Merchant | null> {
  if (!user) {
    user = await getCurrentUser()
  }
  if (!user || user.userType !== 'merchant' || !user.profileId) return null
  return user.profile as unknown as Merchant | null
}
