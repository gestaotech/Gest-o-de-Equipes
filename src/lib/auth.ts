import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { randomUUID, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { parseUserAgent } from "@/lib/user-agent";
import type { OrganizationMember, RoleName } from "@prisma/client";

export const SESSION_COOKIE = "tf_session";
export const ORG_COOKIE = "tf_org";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias
const LAST_ACTIVE_THROTTLE_MS = 5 * 60 * 1000; // atualiza no máx. a cada 5 min

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  orgId?: string;
  /** Id de sessão (segredo no JWT; só o HASH é persistido). */
  sid?: string;
};

export type SessionMeta = { userAgent?: string; ip?: string };

/** Hash do id de sessão — nunca armazenamos o id/token em texto puro. */
export function sessionTokenHash(sid: string): string {
  return createHash("sha256").update(sid).digest("hex");
}

const secretKey = () => {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET não configurado.");
  return new TextEncoder().encode(s);
};

// ------------------------------------------------------------
// Senhas
// ------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ------------------------------------------------------------
// Sessão (JWT em cookie httpOnly)
// ------------------------------------------------------------

export async function createSession(payload: SessionPayload, meta?: SessionMeta): Promise<void> {
  const sid = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const ua = parseUserAgent(meta?.userAgent);
  await prisma.userSession
    .create({
      data: {
        userId: payload.sub,
        tokenHash: sessionTokenHash(sid),
        ipAddress: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        browser: ua.browser,
        device: ua.device,
        os: ua.os,
        expiresAt,
      },
    })
    .catch((err) => {
      console.error("[session:create]", err);
    });

  const token = await new SignJWT({
    email: payload.email,
    name: payload.name,
    orgId: payload.orgId,
    sid,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
}

/** Re-assina o JWT mantendo o MESMO sid/registro de sessão (perfil/config). */
export async function refreshSessionToken(payload: SessionPayload): Promise<void> {
  if (!payload.sid) {
    await createSession(payload);
    return;
  }
  const token = await new SignJWT({
    email: payload.email,
    name: payload.name,
    orgId: payload.orgId,
    sid: payload.sid,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const sid = await extractSid(token);
    if (sid) {
      await prisma.userSession
        .updateMany({
          where: { tokenHash: sessionTokenHash(sid) },
          data: { revokedAt: new Date() },
        })
        .catch(() => {});
    }
  }
  store.delete(SESSION_COOKIE);
  store.delete(ORG_COOKIE);
}

async function extractSid(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return (payload as { sid?: string }).sid ?? null;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  let payload: { sub: string; email: string; name: string; orgId?: string; sid?: string };
  try {
    const verified = await jwtVerify(token, secretKey());
    payload = verified.payload as typeof payload;
  } catch {
    return null;
  }
  if (payload.sid) {
    try {
      const rec = await prisma.userSession.findUnique({
        where: { tokenHash: sessionTokenHash(payload.sid) },
      });
      if (!rec || rec.revokedAt) return null;
      if (rec.lastActiveAt.getTime() < Date.now() - LAST_ACTIVE_THROTTLE_MS) {
        await prisma.userSession.updateMany({
          where: {
            tokenHash: sessionTokenHash(payload.sid),
            lastActiveAt: { lt: new Date(Date.now() - LAST_ACTIVE_THROTTLE_MS) },
          },
          data: { lastActiveAt: new Date() },
        });
      }
    } catch (err) {
      console.error("[session:verify]", err);
      return null;
    }
  }
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    orgId: payload.orgId,
    sid: payload.sid,
  };
}

export type ActiveOrg = {
  id: string;
  name: string;
  slug: string;
  role: RoleName;
  membership: OrganizationMember;
};

export async function getActiveOrg(session: SessionPayload): Promise<ActiveOrg | null> {
  const store = await cookies();
  const requestedId = store.get(ORG_COOKIE)?.value;

  const membership = requestedId
    ? await prisma.organizationMember.findFirst({
        where: { userId: session.sub, organizationId: requestedId, status: "ATIVO" },
        include: { organization: true },
      })
    : null;

  if (!membership) {
    const first = await prisma.organizationMember.findFirst({
      where: { userId: session.sub, status: "ATIVO" },
      include: { organization: true },
      orderBy: { joinedAt: "asc" },
    });
    if (!first) return null;
    return {
      id: first.organization.id,
      name: first.organization.name,
      slug: first.organization.slug,
      role: first.role,
      membership: first,
    };
  }

  return {
    id: membership.organization.id,
    name: membership.organization.name,
    slug: membership.organization.slug,
    role: membership.role,
    membership,
  };
}

// ------------------------------------------------------------
// Guards para server components / actions
// ------------------------------------------------------------

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireSessionApi(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new AppError("UNAUTHORIZED", "Não autenticado.", 401);
  return session;
}

export async function requireOrg(session?: SessionPayload): Promise<ActiveOrg> {
  const s = session ?? (await requireSession());
  const org = await getActiveOrg(s);
  if (!org) redirect("/criar-org");
  return org;
}

/** Organização para páginas/app: redireciona quem não tem convite-se -- sem org. */
export async function sessionWithOrg() {
  const session = await requireSession();
  const org = await getActiveOrg(session);
  return { session, org };
}