// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Get user from Supabase
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Define protected routes
  const protectedPaths = ['/admin', '/merchant', '/company', '/employee']
  const isProtectedRoute = protectedPaths.some((path) => pathname.startsWith(path))
  const isLoginRoute = pathname === '/login'
  const isAuthCallbackRoute = pathname === '/auth/callback'

  // Allow auth callback to proceed
  if (isAuthCallbackRoute) {
    return supabaseResponse
  }

  // Case 1: User is NOT authenticated and tries to access protected route
  if (isProtectedRoute && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Case 2: User IS authenticated and tries to access login page
  if (isLoginRoute && user) {
    // Get user type from metadata
    const userType = user.user_metadata?.user_type as string | undefined
    
    // Define dashboard mapping
    const dashboardMap: Record<string, string> = {
      admin: '/admin',
      merchant: '/merchant',
      company_admin: '/company',
    }
    
    const redirectPath = dashboardMap[userType ?? ''] ?? '/employee'
    return NextResponse.redirect(new URL(redirectPath, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (icons, images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}