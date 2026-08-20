import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import type { AuthResult } from './types'

export async function authenticateFromCookies(): Promise<AuthResult | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: { session } } = await supabase.auth.getSession()
  return { user, accessToken: session?.access_token ?? '' }
}

export async function authenticateFromBearer(request: NextRequest): Promise<AuthResult | null> {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null
  if (!token) return null
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return [] },
        setAll() {},
      },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null
  return { user, accessToken: token }
}

export async function authenticateFromRequest(request: NextRequest): Promise<AuthResult | null> {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authenticateFromBearer(request)
  }
  return authenticateFromCookies()
}
