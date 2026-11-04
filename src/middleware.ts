import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/app", "/onboarding", "/criar-org", "/profile"];
const AUTH_PAGES = ["/login", "/cadastro", "/recuperar", "/resetar-senha", "/primeiro-acesso"];

// ------------------------------------------------------------
// RATE LIMITING (memória em processo; reinicia ao redeploy)
// ------------------------------------------------------------
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX = 10; // máx. 10 requisições por minuto por IP

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

function rateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count };
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);

  // Rate limiting apenas em rotas de autenticação sensíveis
  const isAuthRoute = AUTH_PAGES.includes(pathname);
  if (isAuthRateLimit(pathname)) {
    const limit = rateLimit(ip);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em alguns minutos." },
        { status: 429 }
      );
    }
  }

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

function isAuthRateLimit(pathname: string): boolean {
  return [
    "/login",
    "/cadastro",
    "/recuperar",
    "/resetar-senha",
  ].includes(pathname);
}

export const config = {
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