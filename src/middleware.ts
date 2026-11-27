import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/app", "/onboarding", "/criar-org", "/profile"];
// /cadastro permanece acessível para que a página possa encaminhar usuários
// autenticados à contratação do plano selecionado.
const AUTH_PAGES = ["/login", "/recuperar", "/resetar-senha", "/primeiro-acesso"];

// ------------------------------------------------------------
// RATE LIMITING (memória em processo - funciona em serverless)
// ------------------------------------------------------------
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_LOGIN = 5;
const RATE_LIMIT_MAX_RESET = 3;
const RATE_LIMIT_MAX_GENERAL = 30;

const ENDPOINT_LIMITS: Record<string, { max: number; windowMs: number }> = {
  "/login": { max: RATE_LIMIT_MAX_LOGIN, windowMs: RATE_LIMIT_WINDOW_MS },
  "/cadastro": { max: RATE_LIMIT_MAX_LOGIN, windowMs: RATE_LIMIT_WINDOW_MS },
  "/recuperar": { max: RATE_LIMIT_MAX_RESET, windowMs: RATE_LIMIT_WINDOW_MS },
  "/resetar-senha": { max: RATE_LIMIT_MAX_RESET, windowMs: RATE_LIMIT_WINDOW_MS },
  "/primeiro-acesso": { max: RATE_LIMIT_MAX_GENERAL, windowMs: RATE_LIMIT_WINDOW_MS },
};

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") || "unknown";
}

function rateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }
  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }
  record.count++;
  return { allowed: true, remaining: maxRequests - record.count, resetAt: record.resetAt };
}

function getRateLimitConfig(pathname: string): { max: number; windowMs: number } | null {
  for (const [path, config] of Object.entries(ENDPOINT_LIMITS)) {
    if (pathname === path || pathname.startsWith(`${path}/`)) return config;
  }
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return { max: RATE_LIMIT_MAX_GENERAL, windowMs: RATE_LIMIT_WINDOW_MS };
  }
  return null;
}

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    const ip = getClientIp(request);
    const limitConfig = getRateLimitConfig(pathname);
    if (limitConfig) {
      const limit = rateLimit(`rl:${pathname}:${ip}`, limitConfig.max, limitConfig.windowMs);
      if (!limit.allowed) {
        return NextResponse.json(
          { error: "Muitas tentativas. Tente novamente em alguns minutos.", retryAfter: Math.ceil((limit.resetAt - Date.now()) / 1000) },
          { status: 429 }
        );
      }
    }

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
