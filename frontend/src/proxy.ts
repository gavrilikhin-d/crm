import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const proxy = auth((request) => {
  const isLoggedIn = !!request.auth;
  const isLoginPage = request.nextUrl.pathname === "/login";
  const isAuthRoute = request.nextUrl.pathname.startsWith("/api/auth");
  const isSentryTunnel = request.nextUrl.pathname === "/monitoring";

  if (isAuthRoute || isSentryTunnel) {
    return NextResponse.next();
  }

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
});

export const config = {
  // Pages only — /api/* uses Bearer tokens and Next.js rewrites to the backend
  matcher: ["/((?!api|monitoring|_next/static|_next/image|favicon.ico).*)"]
};
