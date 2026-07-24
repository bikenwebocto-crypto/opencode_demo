// middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

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

async function getUserRoleFromSession(
  email: string,
  token: string,
): Promise<string | null> {
  const cached = roleCache.get(email);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log("Using cached role for:", email, cached.role);
    return cached.role;
  }

  try {
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

    if (!response.ok) {
      console.error("Session API error:", response.status);
      return null;
    }

    const data = await response.json();
    const role = data.user?.role;

    if (role) {
      roleCache.set(email, {
        role,
        timestamp: Date.now(),
      });
    }

    return role ?? null;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  console.log("Middleware running for:", pathname);

  // Redirect root to login
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Public routes
  if (
    pathname === "/login" ||
    pathname === "/auth/callback"
  ) {
    return NextResponse.next();
  }

  // Skip API routes
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const protectedPaths = [
    "/admin",
    "/merchant",
    "/company",
    "/employee",
  ];

  const isProtectedRoute = protectedPaths.some((path) =>
    pathname.startsWith(path),
  );

  // Not protected
  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value!, options);
          });
        },
      },
    },
  );

  // Only protected routes reach here
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!session?.access_token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = await getUserRoleFromSession(
    user.email!,
    session.access_token,
  );

  if (!role) {
    await supabase.auth.signOut();

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "error",
      "Your account role is not configured.",
    );

    return NextResponse.redirect(loginUrl);
  }

  const allowedPaths = ROLE_ACCESS_MAP[role] ?? ["/employee"];

  const hasAccess = allowedPaths.some((path) =>
    pathname.startsWith(path),
  );

  if (!hasAccess) {
    return NextResponse.redirect(
      new URL(ROLE_DASHBOARD_MAP[role] ?? "/employee", request.url),
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};