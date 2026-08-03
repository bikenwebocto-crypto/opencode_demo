import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/server'
import { fetchStoreBranches } from '@/services/nearby-store.service'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'employee') {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const lat = searchParams.get('lat') ? Number(searchParams.get('lat')) : null
    const lng = searchParams.get('lng') ? Number(searchParams.get('lng')) : null
    const category = searchParams.get('category')
    const maxDistance = searchParams.get('maxDistance') ? Number(searchParams.get('maxDistance')) : null
    const openNow = searchParams.get('openNow') === 'true'

    const branches = await fetchStoreBranches({
      userLat: lat,
      userLng: lng,
      category: category || null,
      maxDistanceKm: maxDistance,
      openNow,
    })

    return NextResponse.json({ success: true, data: branches })
  } catch (error) {
    console.error('Employee near-stores API error:', error)
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'Internal server error' } }, { status: 500 })
  }
}
