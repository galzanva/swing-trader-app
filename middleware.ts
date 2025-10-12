import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // Allow access to authenticated users
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

// Protect all routes except public ones
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /api/auth (authentication endpoints)
     * - /login (login page)
     * - /_next/static (static files)
     * - /_next/image (image optimization files)
     * - /favicon.ico (favicon file)
     * - /public (public files)
     */
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico|public).*)",
  ],
};

