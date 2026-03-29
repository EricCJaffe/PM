import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — no auth required
  if (
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/share/") ||
    pathname.startsWith("/api/pm/share") ||
    pathname === "/portal/auth" ||
    pathname.startsWith("/api/pm/portal/invite-accept")
  ) {
    return NextResponse.next();
  }

  // API key auth — allow Bearer pm_key_... for /api/pm/ext/ routes
  // Key validation happens in the route handlers themselves
  if (pathname.startsWith("/api/pm/ext/")) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer pm_key_")) {
      return NextResponse.next();
    }
  }

  // Create a response we can modify (for cookie refresh)
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session (important for keeping cookies alive)
  const { data: { user } } = await supabase.auth.getUser();

  // If not authenticated, redirect to login
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin route protection — check system_role
  if (pathname.startsWith("/admin")) {
    // The /admin page itself and its API routes enforce admin-only access.
    // The middleware just ensures the user is authenticated.
  }

  // Portal routes — already authenticated above, let portal layout handle access
  if (pathname.startsWith("/portal/")) {
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
