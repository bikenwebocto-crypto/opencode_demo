const moduleLoadStart = performance.now();
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createPerfTimer } from '@/lib/perf'
console.log(`[IMPORT] static imports: ${(performance.now() - moduleLoadStart).toFixed(1)}ms`);

export async function GET(request: Request) {
  const timer = createPerfTimer('GET /api/auth/session')

  timer.point('route entered')
  // Module import timing
  const tImp = performance.now();
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  timer.point(`dynamic import @prisma/client + new PrismaClient(): ${(performance.now() - tImp).toFixed(1)}ms`)

  timer.section('Authentication')
  try {
    const tHeader = performance.now();
    const authHeader = request.headers.get('Authorization')
    let token = null
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    }
    timer.point(`header parse: ${(performance.now() - tHeader).toFixed(1)}ms`);

    const tClient = performance.now();
    let supabase
    if (token) {
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          cookies: { getAll() { return [] }, setAll() {} },
          global: { headers: { Authorization: `Bearer ${token}` } },
        }
      )
      timer.point(`createServerClient (token): ${(performance.now() - tClient).toFixed(1)}ms`);
    } else {
      const tCookies = performance.now();
      const cookieStore = await cookies()
      timer.point(`cookies(): ${(performance.now() - tCookies).toFixed(1)}ms`);

      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          cookies: { getAll() { return cookieStore.getAll() }, setAll() {} },
        }
      )
      timer.point(`createServerClient (cookies): ${(performance.now() - tClient).toFixed(1)}ms`);
    }

    const tGetUser = performance.now();
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    timer.point(`supabase.auth.getUser(): ${(performance.now() - tGetUser).toFixed(1)}ms`)

    if (userError || !user) {
      console.error('Auth error:', userError)
      timer.end()
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    timer.section('Database Queries')
    const tQuery = performance.now();
    let role = null
    try {
      const account = await prisma.account.findUnique({
        where: { email: user.email! },
        select: { role: true }
      })
      role = account?.role
    } catch (error) {
      console.error('Error fetching role:', error)
    }
    timer.point(`prisma.account.findUnique: ${(performance.now() - tQuery).toFixed(1)}ms`)

    timer.section('Serialization')
    const tJson = performance.now();
    const response = NextResponse.json({
      authenticated: true,
      user: { id: user.id, email: user.email, role },
    })
    timer.point(`NextResponse.json: ${(performance.now() - tJson).toFixed(1)}ms`)
    timer.end()
    return response
  } catch (error) {
    console.error('Session error:', error)
    timer.end()
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}