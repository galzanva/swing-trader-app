import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIES = [
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
  "__Host-next-auth.session-token",
];

function hasSessionCookie(req: NextRequest) {
  return SESSION_COOKIES.some((name) => Boolean(req.cookies.get(name)?.value));
}

export function middleware(req: NextRequest) {
  if (hasSessionCookie(req)) {
    return NextResponse.next();
  }

  const login = new URL("/login", req.url);
  const nextPath = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  if (nextPath && nextPath !== "/") {
    login.searchParams.set("callbackUrl", nextPath);
  }
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
