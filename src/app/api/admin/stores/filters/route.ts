import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/server'
import { fetchAdminStoreFilters } from '@/services/store.service'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    const filters = await fetchAdminStoreFilters()

    return NextResponse.json({ success: true, data: filters })
  } catch (error) {
    console.error('Admin store filters API error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
