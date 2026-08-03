import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/server'
import { getMerchantFromSession } from '@/lib/merchant-session'
import { fetchStoreBranches } from '@/services/nearby-store.service'

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'merchant') {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 })
    }
    const merchant = await getMerchantFromSession()
    if (!merchant) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Merchant not found' } }, { status: 404 })
    }

    const branches = await fetchStoreBranches({ merchantId: merchant.id })

    return NextResponse.json({ success: true, data: branches })
  } catch (error) {
    console.error('Merchant store-map API error:', error)
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'Internal server error' } }, { status: 500 })
  }
}
