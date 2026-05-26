import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/dashboard", "/onboarding", "/profile", "/skills"];
// Auth-only paths redirect already-authenticated users to /dashboard
const AUTH_ONLY = ["/login", "/signup"];

/**
 * Cookie-presence check only — intentional for the dev/mock auth system.
 *
 * The Edge middleware runtime cannot reach the Node.js server-side InMemoryAuthHandler
 * global (different isolates). Full token validation happens on each protected page's
 * server render via the auth handler (future stories).
 *
 * In production with Supabase, replace this function with @supabase/ssr
 * createServerClient cookie validation, which verifies the JWT signature without
 * server-side state.
 */
function isAuthenticated(request: NextRequest): boolean {
  if (request.cookies.has("auth-token")) return true;
  // Supabase session cookies have the format: sb-<project-ref>-auth-token
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") && cookie.name.endsWith("-auth-token")) {
      return true;
    }
  }
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = isAuthenticated(request);

  if (PROTECTED.some((p) => pathname.startsWith(p)) && !authed) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (AUTH_ONLY.some((p) => pathname.startsWith(p)) && authed) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

// Note: the /api prefix is intentionally excluded — auth API routes must be
// publicly reachable. Add specific /api/protected/* entries here if needed.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
