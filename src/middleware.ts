// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

// Role to dashboard mapping
const ROLE_DASHBOARD_MAP: Record<string, string> = {
  SUPER_ADMIN: '/admin',
  COMPANY_ADMIN: '/company',
  MERCHANT: '/merchant',
  EMPLOYEE: '/employee',
}

// Role to allowed path prefixes
const ROLE_ACCESS_MAP: Record<string, string[]> = {
  SUPER_ADMIN: ['/admin'],
  COMPANY_ADMIN: ['/company'],
  MERCHANT: ['/merchant'],
  EMPLOYEE: ['/employee'],
}

// Cache for user roles (5 minutes)
const roleCache = new Map<string, { role: string; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000

async function getUserRoleFromSession(email: string, token: string): Promise<string | null> {
  // Check cache first
  const cached = roleCache.get(email)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Using cached role for:', email, cached.role)
    return cached.role
  }

  try {
    // Call your session API
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/session`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    })

    if (!response.ok) {
      console.error('Session API error:', response.status)
      return null
    }

    const data = await response.json()
    const role = data.user?.role
    
    console.log('Role from session API:', role, 'for user:', email)

    if (role) {
      // Cache the role
      roleCache.set(email, { role, timestamp: Date.now() })
    }
    
    return role || null
  } catch (error) {
    console.error('Failed to get role from session API:', error)
    return null
  }
}

export async function middleware(request: NextRequest) {
  console.log('Middleware running for:', request.nextUrl.pathname)
  
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet : { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Get user and session
  const { data: { user } } = await supabase.auth.getUser()
  const { data: { session } } = await supabase.auth.getSession()
  
  const pathname = request.nextUrl.pathname

  // Define routes
  const protectedPaths = ['/admin', '/merchant', '/company', '/employee']
  const isProtectedRoute = protectedPaths.some((path) => pathname.startsWith(path))
  const isLoginRoute = pathname === '/login'
  const isAuthCallbackRoute = pathname === '/auth/callback'
  const isApiRoute = pathname.startsWith('/api')

  // Allow auth callback and API routes
  if (isAuthCallbackRoute || isApiRoute) {
    return supabaseResponse
  }

  // Case 1: Not authenticated - redirect to login
  if (isProtectedRoute && !user) {
    console.log('User not authenticated, redirecting to login')
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Case 2: Authenticated user on protected route - check role
  if (user && user.email && isProtectedRoute && session?.access_token) {
    console.log('Checking role for user:', user.email)
    
    // Get role from session API
    const userRole = await getUserRoleFromSession(user.email, session.access_token)
    
    console.log('User role:', userRole)

    // No role found - sign out and show error
    if (!userRole) {
      console.log('No role found, signing out')
      await supabase.auth.signOut()
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('error', 'Your account role is not configured. Please contact system administrator.')
      return NextResponse.redirect(loginUrl)
    }

    // Check if user has access to this path
    const allowedPaths = ROLE_ACCESS_MAP[userRole] || ['/employee']
    const hasAccess = allowedPaths.some(path => pathname.startsWith(path))
    
    console.log('Allowed paths:', allowedPaths)
    console.log('Has access:', hasAccess)

    // If no access, redirect to their correct dashboard
    if (!hasAccess) {
      const correctPath = ROLE_DASHBOARD_MAP[userRole] || '/employee'
      console.log(`Access denied to ${pathname}, redirecting to ${correctPath}`)
      return NextResponse.redirect(new URL(correctPath, request.url))
    }
  }

  // Case 3: User on login page - redirect to their dashboard
  if (isLoginRoute && user && user.email && session?.access_token) {
    console.log('User on login page, checking role for:', user.email)
    
    const userRole = await getUserRoleFromSession(user.email, session.access_token)
    
    if (userRole) {
      const redirectPath = ROLE_DASHBOARD_MAP[userRole] || '/employee'
      console.log('Redirecting from login to:', redirectPath)
      return NextResponse.redirect(new URL(redirectPath, request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}