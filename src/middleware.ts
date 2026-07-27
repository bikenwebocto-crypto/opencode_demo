// middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { createPerfTimer } from "@/lib/perf";

// Role to dashboard mapping
const ROLE_DASHBOARD_MAP: Record<string, string> = {
  SUPER_ADMIN: "/admin",
  COMPANY_ADMIN: "/company",
  MERCHANT: "/merchant",
  EMPLOYEE: "/employee",
};

// Role to allowed path prefixes
const ROLE_ACCESS_MAP: Record<string, string[]> = {
  SUPER_ADMIN: ["/admin"],
  COMPANY_ADMIN: ["/company"],
  MERCHANT: ["/merchant"],
  EMPLOYEE: ["/employee"],
};

// Cache for user roles (5 minutes)
const roleCache = new Map<string, { role: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

let firstMiddlewareRun = true;

async function getUserRoleFromSession(
  email: string,
  token: string,
  timer?: ReturnType<typeof createPerfTimer>,
): Promise<string | null> {
  const tCache = performance.now();
  const cached = roleCache.get(email);
  timer?.point(`role cache lookup: ${(performance.now() - tCache).toFixed(1)}ms`);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log("Using cached role for:", email, cached.role);
    return cached.role;
  }

  try {
    const tFetch = performance.now();
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/session`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      },
    );
    timer?.point(`fetch /api/auth/session: ${(performance.now() - tFetch).toFixed(1)}ms`);

    if (!response.ok) {
      console.error("Session API error:", response.status);
      return null;
    }

    const tJson = performance.now();
    const data = await response.json();
    timer?.point(`response.json: ${(performance.now() - tJson).toFixed(1)}ms`);

    const tSet = performance.now();
    const role = data.user?.role;
    if (role) {
      roleCache.set(email, { role, timestamp: Date.now() });
    }
    timer?.point(`set cache + return: ${(performance.now() - tSet).toFixed(1)}ms`);

    return role ?? null;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const mwStart = performance.now();
  const pathname = request.nextUrl.pathname;
  const timer = createPerfTimer(`MIDDLEWARE ${pathname}`);
  timer.section('Middleware');

  if (firstMiddlewareRun) {
    console.log('[COLD_START] First middleware invocation');
    firstMiddlewareRun = false;
  }

  timer.point(`route entered (pathname=${pathname})`);

  // Redirect root to login
  if (pathname === "/") {
    const tRes = performance.now();
    const res = NextResponse.redirect(new URL("/login", request.url));
    timer.point(`response created: ${(performance.now() - tRes).toFixed(1)}ms`);
    timer.end()
    return res;
  }

  // Public routes
  if (pathname === "/login" || pathname === "/auth/callback") {
    const tRes = performance.now();
    const res = NextResponse.next();
    timer.point(`response created: ${(performance.now() - tRes).toFixed(1)}ms`);
    timer.end()
    return res;
  }

  // Skip API routes
  if (pathname.startsWith("/api")) {
    const tRes = performance.now();
    const res = NextResponse.next();
    timer.point(`response created: ${(performance.now() - tRes).toFixed(1)}ms`);
    timer.end()
    return res;
  }

  const protectedPaths = ["/admin", "/merchant", "/company", "/employee"];
  const isProtectedRoute = protectedPaths.some((path) => pathname.startsWith(path));

  if (!isProtectedRoute) {
    const tRes = performance.now();
    const res = NextResponse.next();
    timer.point(`response created: ${(performance.now() - tRes).toFixed(1)}ms`);
    timer.end()
    return res;
  }

  timer.point('creating response + supabase client');
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value!, options);
          });
        },
      },
    },
  );

  const tGetUser = performance.now();
  const { data: { user } } = await supabase.auth.getUser();
  timer.point(`supabase.auth.getUser(): ${(performance.now() - tGetUser).toFixed(1)}ms`);

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    const tRes = performance.now();
    const res = NextResponse.redirect(loginUrl);
    timer.point(`redirect response: ${(performance.now() - tRes).toFixed(1)}ms`);
    timer.end()
    return res;
  }

  const tGetSession = performance.now();
  const { data: { session } } = await supabase.auth.getSession();
  timer.point(`supabase.auth.getSession(): ${(performance.now() - tGetSession).toFixed(1)}ms`);

  if (!session?.access_token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    const tRes = performance.now();
    const res = NextResponse.redirect(loginUrl);
    timer.point(`redirect response: ${(performance.now() - tRes).toFixed(1)}ms`);
    timer.end()
    return res;
  }

  timer.point('before getUserRoleFromSession');

  const role = await getUserRoleFromSession(user.email!, session.access_token, timer);

  if (!role) {
    const tSignOut = performance.now();
    await supabase.auth.signOut();
    timer.point(`signOut: ${(performance.now() - tSignOut).toFixed(1)}ms`);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Your account role is not configured.");
    const tRes = performance.now();
    const res = NextResponse.redirect(loginUrl);
    timer.point(`redirect response: ${(performance.now() - tRes).toFixed(1)}ms`);
    timer.end()
    return res;
  }

  const tAccess = performance.now();
  const allowedPaths = ROLE_ACCESS_MAP[role] ?? ["/employee"];
  const hasAccess = allowedPaths.some((path) => pathname.startsWith(path));
  timer.point(`access check: ${(performance.now() - tAccess).toFixed(1)}ms`);

  if (!hasAccess) {
    const tRes = performance.now();
    const res = NextResponse.redirect(new URL(ROLE_DASHBOARD_MAP[role] ?? "/employee", request.url));
    timer.point(`redirect response: ${(performance.now() - tRes).toFixed(1)}ms`);
    timer.end()
    return res;
  }

  const tRes = performance.now();
  timer.point(`response created: ${(performance.now() - tRes).toFixed(1)}ms`);
  timer.end()
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};