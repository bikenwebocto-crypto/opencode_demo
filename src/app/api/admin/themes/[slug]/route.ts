import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/server'
import { getThemeBySlug, updateThemeSettings, type ThemeSettings } from '@/lib/theme'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const user = await getCurrentUser()
  if (!user || user.userType !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const theme = await getThemeBySlug(slug)
  if (!theme) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(theme)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const user = await getCurrentUser()
  if (!user || user.userType !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json() as Partial<ThemeSettings>
  try {
    const updated = await updateThemeSettings(slug, body)
    return NextResponse.json(updated)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
