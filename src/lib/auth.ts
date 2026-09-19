import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { OrganizationMember, RoleName } from "@prisma/client";

export const SESSION_COOKIE = "tf_session";
export const ORG_COOKIE = "tf_org";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  orgId?: string;
};

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

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ email: payload.email, name: payload.name, orgId: payload.orgId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(ORG_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      name: payload.name as string,
      orgId: payload.orgId as string | undefined,
    };
  } catch {
    return null;
  }
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
        where: { userId: session.sub, organizationId: requestedId },
        include: { organization: true },
      })
    : null;

  if (!membership) {
    const first = await prisma.organizationMember.findFirst({
      where: { userId: session.sub },
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
  if (!session) throw new Error("UNAUTHORIZED");
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