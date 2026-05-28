import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const accessToken =
    request.cookies.get('sb-access-token')?.value

  console.log('PATH:', pathname)
  console.log('TOKEN EXISTS:', !!accessToken)

  const protectedPaths = [
    '/admin',
    '/merchant',
    '/company',
    '/employee',
  ]

  const isProtected = protectedPaths.some((path) =>
    pathname.startsWith(path)
  )

  const isLoginPage = pathname === '/login'

  // NOT LOGGED IN
  if (isProtected && !accessToken) {
    console.log('Redirecting to login')

    const loginUrl = new URL('/login', request.url)

    loginUrl.searchParams.set('redirectTo', pathname)

    return NextResponse.redirect(loginUrl)
  }

  // LOGGED IN USER VISITS LOGIN PAGE
  if (isLoginPage && accessToken) {
    const redirectTo =
      request.nextUrl.searchParams.get('redirectTo') ||
      '/admin'

    // IMPORTANT LOOP PREVENTION
    if (pathname !== redirectTo) {
      console.log('Redirecting authenticated user')

      return NextResponse.redirect(
        new URL(redirectTo, request.url)
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}