"use server";

import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  destroySession,
  refreshSessionToken,
  sessionTokenHash,
  hashPassword,
  verifyPassword,
  requireSessionApi,
} from "@/lib/auth";
import { handleAction, AppError, ok } from "@/lib/errors";
import {
  signUpSchema,
  loginSchema,
  forgotSchema,
  resetSchema,
  accountUpdateSchema,
} from "@/lib/validations";
import { ensureCatalogs } from "@/lib/catalog";
import { logActivity } from "@/server/activity";

const resetSecret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET não configurado.");
  return new TextEncoder().encode(s);
};

const normalizeEmail = (e: string) => e.trim().toLowerCase();

/** Metadados do dispositivo para a lista de sessões (user-agent + IP). */
async function sessionMeta() {
  try {
    const h = await headers();
    return {
      userAgent: h.get("user-agent") ?? undefined,
      ip:
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        h.get("x-real-ip") ||
        undefined,
    };
  } catch {
    return {};
  }
}

export async function register(input: unknown) {
  return handleAction(async () => {
    const data = signUpSchema.parse(input);
    const email = normalizeEmail(data.email);
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new AppError("EMAIL_IN_USE", "Este e-mail já está cadastrado. Faça login.", 409);
    }
    const user = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email,
        passwordHash: await hashPassword(data.password),
      },
    });
    await ensureCatalogs();
    await createSession({ sub: user.id, email: user.email, name: user.name }, await sessionMeta());
    return { id: user.id, name: user.name };
  });
}

export async function login(input: unknown) {
  return handleAction(async () => {
    const data = loginSchema.parse(input);
    const email = normalizeEmail(data.email);
    const user = await prisma.user.findUnique({ where: { email } });
    const valid =
      user && (await verifyPassword(data.password, user.passwordHash));
    if (!user || !valid) {
      throw new AppError("INVALID_CREDENTIALS", "E-mail ou senha incorretos.", 401);
    }
    // Respeita a organização salva em tf_org; só cai para a mais antiga se
    // o cookie não apontar para uma organização da qual o usuário faz parte.
    const store = await cookies();
    const requestedId = store.get("tf_org")?.value;
    const membership = requestedId
      ? await prisma.organizationMember.findFirst({
          where: { userId: user.id, organizationId: requestedId, status: "ATIVO" },
          select: { organizationId: true },
        })
      : null;
    const active = membership ?? (await prisma.organizationMember.findFirst({
      where: { userId: user.id, status: "ATIVO" },
      orderBy: { joinedAt: "asc" },
      select: { organizationId: true },
    }));
    await createSession(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        orgId: active?.organizationId,
      },
      await sessionMeta()
    );
    return { id: user.id, name: user.name, hasOrg: Boolean(active) };
  });
}

export async function logout() {
  await destroySession();
  return ok({});
}

export async function requestReset(input: unknown) {
  return handleAction(async () => {
    const data = forgotSchema.parse(input);
    const email = normalizeEmail(data.email);
    const user = await prisma.user.findUnique({ where: { email } });
    // Sempre responde "sent" do mesmo jeito para não vazar e-mails cadastrados.
    // Em produção o token NUNCA é devolvido pela resposta (não há SMTP configurado,
    // então a recuperação fica restrita ao ambiente local de desenvolvimento).
    const safeReturn =
      process.env.NODE_ENV === "production" ? false : Boolean(user);
    const token =
      process.env.NODE_ENV === "production"
        ? null
        : await new SignJWT({ type: "password_reset" })
            .setProtectedHeader({ alg: "HS256" })
            .setSubject(user?.id ?? "x")
            .setIssuedAt()
            .setExpirationTime("1h")
            .sign(resetSecret());
    return {
      sent: Boolean(user),
      resetToken: safeReturn ? token : null,
      resetUrl: safeReturn ? `/resetar-senha?t=${token}` : null,
    };
  });
}

export async function resetPassword(input: unknown) {
  return handleAction(async () => {
    const data = resetSchema.parse(input);
    let payload: { sub: string; type?: string };
    try {
      const { payload: p } = await jwtVerify(data.token, resetSecret());
      payload = p as { sub: string; type?: string };
    } catch {
      throw new AppError("INVALID_TOKEN", "Link inválido ou expirado.", 400);
    }
    if (payload.type !== "password_reset") {
      throw new AppError("INVALID_TOKEN", "Link inválido ou expirado.", 400);
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new AppError("INVALID_TOKEN", "Usuário não encontrado.", 404);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(data.password) },
    });
    // Recuperação de senha invalida todas as sessões do usuário (token antigo morre).
    await prisma.userSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return ok({});
  });
}

export async function updateAccountInfo(input: {
  name?: string;
  currentPassword?: string;
  newPassword?: string;
}) {
  return handleAction(async () => {
    const data = accountUpdateSchema.parse(input);
    const session = await requireSessionApi();
    const user = await prisma.user.findUnique({ where: { id: session.sub } });
    if (!user) throw new AppError("NOT_FOUND", "Usuário não encontrado.", 404);

    const next: { name?: string; passwordHash?: string } = {};
    if (data.name?.trim()) {
      next.name = data.name.trim();
    }
    if (data.newPassword) {
      const valid = await verifyPassword(data.currentPassword!, user.passwordHash);
      if (!valid) {
        throw new AppError("WRONG_PASSWORD", "Senha atual incorreta.", 400);
      }
      next.passwordHash = await hashPassword(data.newPassword);
    }
    if (Object.keys(next).length === 0) return ok({});
    const updated = await prisma.user.update({ where: { id: user.id }, data: next });
    // Troca de senha invalida as demais sessões e mantém a atual viva.
    if (data.newPassword && session.sid) {
      await prisma.userSession.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
          tokenHash: { not: sessionTokenHash(session.sid) },
        },
        data: { revokedAt: new Date() },
      });
    }
    await refreshSessionToken({
      sub: updated.id,
      email: updated.email,
      name: updated.name,
      orgId: session.orgId,
      sid: session.sid,
    });
    if (data.newPassword && session.orgId) {
      await logActivity({
        action: "PASSWORD_CHANGED",
        entity: "user",
        entityId: updated.id,
      });
    }
    return { name: updated.name };
  });
}