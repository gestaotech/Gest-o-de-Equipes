import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/app", "/onboarding", "/criar-org", "/profile"];
// /cadastro permanece acessível para encaminhar usuários à contratação.
const AUTH_PAGES = ["/login", "/recuperar", "/resetar-senha", "/primeiro-acesso"];

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    const hasToken = request.cookies.has("tf_session");

    if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      if (!hasToken) {
        const url = new URL("/login", request.url);
        url.searchParams.set("next", pathname + request.nextUrl.search);
        return NextResponse.redirect(url);
      }
    }

    if (AUTH_PAGES.includes(pathname) && hasToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // O middleware controla navegação e proteção de páginas, não tentativas
    // de autenticação. O rate limit efetivo fica nas server actions, associado
    // à identidade (e-mail/IP), evitando bloquear todos os usuários do mesmo IP.
    return NextResponse.next();
  } catch (error) {
    console.error("[middleware error]", error);
    return NextResponse.next();
  }
}

export const config = {
  runtime: "nodejs",
  matcher: [
    "/dashboard/:path*",
    "/app/:path*",
    "/onboarding/:path*",
    "/criar-org/:path*",
    "/profile",
    "/login",
    "/cadastro",
    "/recuperar",
    "/resetar-senha",
    "/primeiro-acesso",
  ],
};
