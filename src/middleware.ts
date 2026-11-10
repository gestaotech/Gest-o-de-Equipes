import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const PROTECTED = ["/dashboard", "/app", "/onboarding", "/criar-org", "/profile"];
const AUTH_PAGES = ["/login", "/cadastro", "/recuperar", "/resetar-senha", "/primeiro-acesso"];

// ------------------------------------------------------------
// RATE LIMITING DISTRIBUÍDO (via PostgreSQL/Prisma)
// Funciona em ambiente serverless (Vercel) pois o estado está no banco.
// ------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX_LOGIN = 5;   // máx. 5 tentativas de login por minuto por IP
const RATE_LIMIT_MAX_RESET = 3;   // máx. 3 tentativas de recuperação por minuto por IP
const RATE_LIMIT_MAX_2FA = 10;    // máx. 10 tentativas de 2FA por minuto por IP
const RATE_LIMIT_MAX_GENERAL = 30; // máx. 30 requisições gerais por minuto por IP

// Limites por endpoint
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
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowStart = now - (now % windowMs);
  const windowEnd = windowStart + windowMs;

  const existing = await prisma.rateLimitRecord.findUnique({
    where: { key },
  });

  const existingResetAt = existing?.resetAt ? existing.resetAt.getTime() : 0;

  if (!existing || existingResetAt <= now) {
    await prisma.rateLimitRecord.create({
      data: {
        key,
        count: 1,
        resetAt: new Date(windowEnd),
      },
    });
    return { allowed: true, remaining: maxRequests - 1, resetAt: windowEnd };
  }

  if (existing.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: existingResetAt };
  }

  await prisma.rateLimitRecord.update({
    where: { key },
    data: { count: existing.count + 1 },
  });

  return { allowed: true, remaining: maxRequests - existing.count - 1, resetAt: existingResetAt };
}

function getRateLimitConfig(pathname: string): { max: number; windowMs: number } | null {
  for (const [path, config] of Object.entries(ENDPOINT_LIMITS)) {
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      return config;
    }
  }
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return { max: RATE_LIMIT_MAX_GENERAL, windowMs: RATE_LIMIT_WINDOW_MS };
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);

  const limitConfig = getRateLimitConfig(pathname);
  if (limitConfig) {
    const rateLimitKey = `rl:${pathname}:${ip}`;
    const limit = await checkRateLimit(rateLimitKey, limitConfig.max, limitConfig.windowMs);
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
  // Prisma requires the Node.js runtime; the Edge runtime is not supported.
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
