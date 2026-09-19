import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/app", "/onboarding", "/criar-org"];
const AUTH_PAGES = ["/login", "/cadastro", "/recuperar-senha", "/resetar-senha"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasToken = request.cookies.has("tf_session");

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (!hasToken) {
      const url = new URL("/login", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (AUTH_PAGES.includes(pathname) && hasToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/app/:path*",
    "/onboarding/:path*",
    "/criar-org/:path*",
    "/login",
    "/cadastro",
    "/recuperar-senha",
    "/resetar-senha",
  ],
};