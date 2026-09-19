"use server";

import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  destroySession,
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
} from "@/lib/validations";
import { ensureCatalogs } from "@/lib/catalog";

const resetSecret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET não configurado.");
  return new TextEncoder().encode(s);
};

const normalizeEmail = (e: string) => e.trim().toLowerCase();

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
    await createSession({ sub: user.id, email: user.email, name: user.name });
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
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: user.id },
      orderBy: { joinedAt: "asc" },
      select: { organizationId: true },
    });
    await createSession({
      sub: user.id,
      email: user.email,
      name: user.name,
      orgId: membership?.organizationId,
    });
    return { id: user.id, name: user.name, hasOrg: Boolean(membership) };
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
    // Sempre responde igual para não vazar e-mails cadastrados.
    const token = await new SignJWT({ type: "password_reset" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user?.id ?? "x")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(resetSecret());
    return {
      sent: Boolean(user),
      resetToken: user ? token : null,
      resetUrl: user ? `/resetar-senha?t=${token}` : null,
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
    return ok({});
  });
}

export async function updateAccountInfo(input: {
  name?: string;
  currentPassword?: string;
  newPassword?: string;
}) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const user = await prisma.user.findUnique({ where: { id: session.sub } });
    if (!user) throw new AppError("NOT_FOUND", "Usuário não encontrado.", 404);

    const next: { name?: string; passwordHash?: string } = {};
    if (input.name?.trim()) {
      next.name = input.name.trim();
    }
    if (input.newPassword) {
      if (!input.currentPassword) {
        throw new AppError("PASSWORD_REQUIRED", "Informe a senha atual.", 400);
      }
      const valid = await verifyPassword(input.currentPassword, user.passwordHash);
      if (!valid) {
        throw new AppError("WRONG_PASSWORD", "Senha atual incorreta.", 400);
      }
      next.passwordHash = await hashPassword(input.newPassword);
    }
    if (Object.keys(next).length === 0) return ok({});
    const updated = await prisma.user.update({ where: { id: user.id }, data: next });
    await destroySession();
    await createSession({ sub: updated.id, email: updated.email, name: updated.name });
    return { name: updated.name };
  });
}