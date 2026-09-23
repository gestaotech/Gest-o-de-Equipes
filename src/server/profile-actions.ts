"use server";

import { prisma } from "@/lib/prisma";
import {
  requireSessionApi,
  sessionTokenHash,
  hashPassword,
  verifyPassword,
  refreshSessionToken,
  destroySession,
  type SessionPayload,
} from "@/lib/auth";
import { handleAction, AppError, ok } from "@/lib/errors";
import {
  profileSchema,
  passwordChangeSchema,
  userPreferencesSchema,
} from "@/lib/validations";
import { Prisma } from "@prisma/client";
import { logActivity } from "@/server/activity";

const AVATAR_DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,/;
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_MAX_LEN = Math.ceil((AVATAR_MAX_BYTES / 3) * 4) + 1024;

/** Sessão + bloqueio de membros INATIVOS (perfil é pessoal, mas não para inativos). */
async function profileContext(): Promise<SessionPayload> {
  const session = await requireSessionApi();
  if (session.orgId) {
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.sub, organizationId: session.orgId },
      select: { status: true },
    });
    if (membership && membership.status === "INATIVO") {
      throw new AppError(
        "FORBIDDEN",
        "Sua conta está desativada nesta organização.",
        403
      );
    }
  }
  return session;
}

async function logProfile(
  session: SessionPayload,
  action: string,
  newData?: Prisma.InputJsonValue
) {
  if (session.orgId) {
    await logActivity(session.orgId, session.sub, action, "user", session.sub, newData);
  }
}

export async function updateProfile(input: unknown) {
  return handleAction(async () => {
    const data = profileSchema.parse(input);
    const session = await profileContext();
    const user = await prisma.user.findUnique({ where: { id: session.sub } });
    if (!user) throw new AppError("NOT_FOUND", "Usuário não encontrado.", 404);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { name: data.name, phone: data.phone ?? null },
    });

    await refreshSessionToken({
      sub: updated.id,
      email: updated.email,
      name: updated.name,
      orgId: session.orgId,
      sid: session.sid,
    });
    await logProfile(session, "PROFILE_UPDATED", {
      name: updated.name,
      phone: updated.phone,
    });
    return { name: updated.name };
  });
}

export async function changePassword(input: unknown) {
  return handleAction(async () => {
    const data = passwordChangeSchema.parse(input);
    const session = await profileContext();
    const user = await prisma.user.findUnique({ where: { id: session.sub } });
    if (!user) throw new AppError("NOT_FOUND", "Usuário não encontrado.", 404);

    const valid = await verifyPassword(data.currentPassword, user.passwordHash);
    if (!valid) {
      throw new AppError("WRONG_PASSWORD", "Senha atual incorreta.", 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(data.newPassword) },
    });

    // Invalida TODAS as outras sessões; mantém a atual viva.
    const currentHash = session.sid ? sessionTokenHash(session.sid) : null;
    await prisma.userSession.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
        ...(currentHash ? { tokenHash: { not: currentHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });

    await logProfile(session, "PASSWORD_CHANGED");
    return ok({});
  });
}

export async function updatePreferences(input: unknown) {
  return handleAction(async () => {
    const data = userPreferencesSchema.parse(input);
    const session = await profileContext();
    await prisma.userPreference.upsert({
      where: { userId: session.sub },
      update: data,
      create: { userId: session.sub, ...data },
    });
    await logProfile(session, "PREFERENCES_UPDATED");
    return ok({});
  });
}

export async function updateAvatar(input: unknown) {
  return handleAction(async () => {
    const session = await profileContext();
    if (
      typeof input !== "string" ||
      !AVATAR_DATA_URL_RE.test(input) ||
      input.length > AVATAR_MAX_LEN
    ) {
      throw new AppError(
        "INVALID_AVATAR",
        "Arquivo inválido. Use JPG, PNG ou WEBP de até 5 MB.",
        400
      );
    }
    await prisma.user.update({
      where: { id: session.sub },
      data: { avatarUrl: input },
    });
    await logProfile(session, "AVATAR_UPDATED");
    return ok({});
  });
}

export async function removeAvatar() {
  return handleAction(async () => {
    const session = await profileContext();
    await prisma.user.update({
      where: { id: session.sub },
      data: { avatarUrl: null },
    });
    await logProfile(session, "AVATAR_REMOVED");
    return ok({});
  });
}

export async function revokeSession(input: unknown) {
  return handleAction(async () => {
    const session = await profileContext();
    if (typeof input !== "string" || !input) {
      throw new AppError("INVALID_INPUT", "Sessão inválida.", 400);
    }
    const target = await prisma.userSession.findFirst({
      where: { id: input, userId: session.sub },
      select: { id: true, tokenHash: true, revokedAt: true },
    });
    if (!target) {
      throw new AppError("NOT_FOUND", "Sessão não encontrada.", 404);
    }
    if (target.revokedAt) return ok({});
    if (session.sid && target.tokenHash === sessionTokenHash(session.sid)) {
      throw new AppError(
        "CURRENT_SESSION",
        "Esta é a sessão atual. Use “Sair” para encerrá-la.",
        400
      );
    }
    await prisma.userSession.updateMany({
      where: { id: target.id, userId: session.sub, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await logProfile(session, "SESSION_REVOKED");
    return ok({});
  });
}

export async function revokeOtherSessions() {
  return handleAction(async () => {
    const session = await profileContext();
    if (!session.sid) return { revoked: 0 };
    const { count } = await prisma.userSession.updateMany({
      where: {
        userId: session.sub,
        revokedAt: null,
        tokenHash: { not: sessionTokenHash(session.sid) },
      },
      data: { revokedAt: new Date() },
    });
    await logProfile(session, "SESSIONS_REVOKED", { revoked: count });
    return { revoked: count };
  });
}

export async function deleteAccount(input: unknown) {
  return handleAction(async () => {
    const session = await profileContext();
    const password =
      typeof input === "object" && input && "password" in input
        ? (input as { password?: unknown }).password
        : undefined;
    if (typeof password !== "string" || !password) {
      throw new AppError(
        "INVALID_INPUT",
        "Informe sua senha para confirmar a exclusão.",
        400
      );
    }

    const user = await prisma.user.findUnique({ where: { id: session.sub } });
    if (!user) throw new AppError("NOT_FOUND", "Usuário não encontrado.", 404);
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new AppError("WRONG_PASSWORD", "Senha incorreta.", 400);
    }

    const ownsOrg = await prisma.organizationMember.count({
      where: { userId: user.id, role: "OWNER" },
    });
    if (ownsOrg > 0) {
      throw new AppError(
        "DELETE_OWNER",
        "Você é proprietário de uma organização. Transfira a propriedade ou remova a organização antes de excluir a conta.",
        409
      );
    }

    await prisma.$transaction([
      prisma.userSession.deleteMany({ where: { userId: user.id } }),
      prisma.userPreference.deleteMany({ where: { userId: user.id } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);
    await destroySession();
    return ok({});
  });
}
