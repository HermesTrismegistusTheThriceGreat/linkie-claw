import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Auth.js session token cookie name
const AUTH_TOKEN_NAME = "authjs.session-token";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to login page, auth API, and static files
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/internal") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/uploads")
  ) {
    return NextResponse.next();
  }

  // Check for session token in cookies
  const sessionToken = request.cookies.get(AUTH_TOKEN_NAME)?.value;

  // Redirect to login if not authenticated
  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|api/cron|api/webhooks|api/internal|login|_next/static|_next/image|favicon.ico|images/|uploads/).*)"],
};
