import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/server'
import { getAllThemes } from '@/lib/theme'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.userType !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const themes = await getAllThemes()
  return NextResponse.json(themes)
}
