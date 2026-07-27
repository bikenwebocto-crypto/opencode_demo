import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const ROLE_DASHBOARD_MAP: Record<string, string> = {
  SUPER_ADMIN: "/admin",
  COMPANY_ADMIN: "/company",
  MERCHANT: "/merchant",
  EMPLOYEE: "/employee",
};

const ROLE_ACCESS_MAP: Record<string, string[]> = {
  SUPER_ADMIN: ["/admin"],
  COMPANY_ADMIN: ["/company"],
  MERCHANT: ["/merchant"],
  EMPLOYEE: ["/employee"],
};

const roleCache = new Map<string, { role: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

const SESSION_API = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/session`;

async function fetchRole(supabase: ReturnType<typeof createServerClient>, email: string): Promise<string | null> {
  const cached = roleCache.get(email);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.role;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return null

    const res = await fetch(SESSION_API, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "x-middleware-email": email,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })
    if (!res.ok) return null

    const data = await res.json()
    const role: string | undefined = data.user?.role
    if (role) {
      roleCache.set(email, { role, timestamp: Date.now() })
    }
    return role ?? null
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  if (pathname === "/login" || pathname === "/auth/callback") {
    return NextResponse.next()
  }
  if (pathname.startsWith("/api")) {
    return NextResponse.next()
  }

  const isProtected = ["/admin", "/merchant", "/company", "/employee"].some((p) =>
    pathname.startsWith(p),
  )
  if (!isProtected) {
    return NextResponse.next()
  }

  const requestHeaders = new Headers(request.headers)

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value!, options)
          })
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirectTo", pathname)
    return NextResponse.redirect(loginUrl)
  }

  const role = await fetchRole(supabase, user.email!)

  if (!role) {
    await supabase.auth.signOut()
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("error", "Your account role is not configured.")
    return NextResponse.redirect(loginUrl)
  }

  const allowedPaths = ROLE_ACCESS_MAP[role] ?? ["/employee"]
  const hasAccess = allowedPaths.some((path) => pathname.startsWith(path))
  if (!hasAccess) {
    return NextResponse.redirect(
      new URL(ROLE_DASHBOARD_MAP[role] ?? "/employee", request.url),
    )
  }

  requestHeaders.set("x-auth-role", role)
  requestHeaders.set("x-auth-email", user.email!)

  response.headers.set("x-auth-role", role)
  response.headers.set("x-auth-email", user.email!)
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};