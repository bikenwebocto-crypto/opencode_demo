import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  try {
    // Try to get token from Authorization header first
    const authHeader = request.headers.get('Authorization')
    let token = null
    
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    }

    let supabase
    
    if (token) {
      // If token is provided, create client with token
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          cookies: {
            getAll() { return [] },
            setAll() {},
          },
          global: {
            headers: { Authorization: `Bearer ${token}` }
          },
        }
      )
    } else {
      // Otherwise use cookies
      const cookieStore = await cookies()
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          cookies: {
            getAll() { return cookieStore.getAll() },
            setAll() {},
          },
        }
      )
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('Auth error:', userError)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get role from database (using your existing DB connection)
    // Import Prisma at the top if you have it
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    
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

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        role: role,
      }
    })
  } catch (error) {
    console.error('Session error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}