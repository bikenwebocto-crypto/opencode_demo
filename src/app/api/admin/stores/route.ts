import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/server'
import { fetchAdminStores } from '@/services/store.service'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const city = searchParams.get('city')
    const state = searchParams.get('state')
    const merchantId = searchParams.get('merchantId')
    const status = searchParams.get('status')
    const isPrimary = searchParams.get('isPrimary')
    const search = searchParams.get('search')

    const result = await fetchAdminStores({
      category: category || undefined,
      city: city || undefined,
      state: state || undefined,
      merchantId: merchantId || undefined,
      status: status || undefined,
      isPrimary: isPrimary === 'true' ? true : isPrimary === 'false' ? false : undefined,
      search: search || undefined,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Admin stores API error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
