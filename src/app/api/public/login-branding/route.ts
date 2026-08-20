import { NextResponse } from 'next/server'
import { getPublicBranding } from '@/features/admin/settings/login-branding/services/login-branding.service'

export async function GET() {
  try {
    const branding = await getPublicBranding()
    return NextResponse.json({ success: true, data: branding })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to load branding configuration' },
      { status: 500 },
    )
  }
}
