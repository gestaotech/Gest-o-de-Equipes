"use server";

import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  destroySession,
  refreshSessionToken,
  sessionTokenHash,
  hashPassword,
  verifyPassword,
  requireSessionApi,
  secretKey,
} from "@/lib/auth";
import { handleAction, AppError, ok } from "@/lib/errors";
import {
  signUpSchema,
  loginSchema,
  forgotSchema,
  resetSchema,
  firstAccessSchema,
  accountUpdateSchema,
} from "@/lib/validations";
import { ensureCatalogs } from "@/lib/catalog";
import { logActivity } from "@/server/activity";
import { issueAccountToken, consumeAccountToken } from "@/server/account-token";
import { sendPasswordResetEmail } from "@/lib/email";
import { decrypt } from "@/lib/encryption";
import { validateTOTP, validateBackupCode } from "@/server/two-factor-actions";

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

    // Verificar se o usuário tem 2FA ativado
    const tfa = await prisma.userTwoFactor.findUnique({
      where: { userId: user.id },
      select: { enabled: true },
    });

    if (tfa?.enabled) {
      // 2FA obrigatório: criar sessão temporária (2FA pendente)
      // O token temporário é válido por 5 minutos e só permite completar o 2FA
      const tempToken = await new SignJWT({
        sub: user.id,
        email: user.email,
        name: user.name,
        purpose: "2fa_pending",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(user.id)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(secretKey());

      return {
        id: user.id,
        name: user.name,
        hasOrg: false,
        twoFactorRequired: true,
        tempToken,
        message: "Segundo fator de autenticação necessário.",
      };
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

/**
 * Completa o 2FA após login com senha.
 * Requer um tempToken válido (gerado durante o login quando 2FA está ativado).
 */
export async function completeTwoFactorLogin(input: { tempToken: string; token: string }) {
  return handleAction(async () => {
    const { tempToken, token } = input;

    // Verificar o token temporário
    let payload: { sub: string; email: string; name: string; purpose: string };
    try {
      const { payload: p } = await jwtVerify(tempToken, secretKey());
      payload = p as { sub: string; email: string; name: string; purpose: string };
      if (payload.purpose !== "2fa_pending") {
        throw new AppError("INVALID_TOKEN", "Token inválido.", 400);
      }
    } catch {
      throw new AppError("INVALID_TOKEN", "Token temporário inválido ou expirado.", 400);
    }

    // Verificar se o usuário tem 2FA ativado
    const tfa = await prisma.userTwoFactor.findUnique({
      where: { userId: payload.sub },
    });
    if (!tfa?.enabled || !tfa.secretEncrypted) {
      throw new AppError("NOT_FOUND", "2FA não está configurado para este usuário.", 404);
    }

    // Descriptografar o segredo e validar o código TOTP
    const secret = await decrypt(tfa.secretEncrypted);
    if (!(await validateTOTP(secret, token, 1))) {
      // Verificar se é um código de backup
      const codesHash: string[] = JSON.parse(tfa.backupCodesHash || "[]");
      const result = await validateBackupCode(token.trim(), codesHash);
      if (!result.valid) {
        throw new AppError("INVALID_TOKEN", "Código de verificação inválido.", 400);
      }
      // Atualizar hashes dos códigos de backup removendo o usado
      await prisma.userTwoFactor.update({
        where: { userId: payload.sub },
        data: { backupCodesHash: JSON.stringify(result.remainingHashes) },
      });
    }

    // Buscar organização ativa do usuário
    const store = await cookies();
    const requestedId = store.get("tf_org")?.value;
    const membership = requestedId
      ? await prisma.organizationMember.findFirst({
          where: { userId: payload.sub, organizationId: requestedId, status: "ATIVO" },
          select: { organizationId: true },
        })
      : null;
    const active = membership ?? (await prisma.organizationMember.findFirst({
      where: { userId: payload.sub, status: "ATIVO" },
      orderBy: { joinedAt: "asc" },
      select: { organizationId: true },
    }));

    // Criar sessão completa após validação do 2FA
    await createSession(
      {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        orgId: active?.organizationId,
      },
      await sessionMeta()
    );

    return {
      id: payload.sub,
      name: payload.name,
      hasOrg: Boolean(active),
      twoFactorCompleted: true,
    };
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
    
    // Busca usuário por e-mail
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });
    
    // Sempre retorna sucesso para não vazar existência de e-mail (proteção contra enumeração)
    if (!user) {
      return ok({ sent: true });
    }
    
    // Gera token persistente (AccountToken) para redefinição de senha
    // Isso automaticamente invalida quaisquer tokens anteriores do mesmo tipo
    const rawToken = await issueAccountToken(user.id, 'PASSWORD_RESET');
    
    // Envia e-mail com link de redefinição
    // Se o provedor não estiver configurado, o token é registrado em log (desenvolvimento)
    // ou apenas documentado (produção), sem simular sucesso
    await sendPasswordResetEmail(email, rawToken);
    
    return ok({ sent: true });
  });
}

export async function resetPassword(input: unknown) {
  return handleAction(async () => {
    const data = resetSchema.parse(input);
    
    // Usa transação atômica para garantir que o token só seja consumido
    // se a senha for alterada com sucesso. Se qualquer etapa falhar,
    // o token não é consumido e pode ser reutilizado.
    await prisma.$transaction(async (tx) => {
      // Consome o token de redefinição (uso único, dentro da transação)
      const { userId } = await consumeAccountToken(data.token, 'PASSWORD_RESET', tx);
      
      // Atualiza a senha do usuário
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: await hashPassword(data.password) },
      });
      
      // Revoga todas as sessões ativas do usuário (força novo login)
      await tx.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    
    return ok({});
  });
}

/**
 * Primeiro acesso: o colaborador define a própria senha a partir do token
 * de ativação gerado no cadastro. O admin nunca conhece/define essa senha.
 *
 * Usa transação atômica para garantir que:
 * 1. O token só seja consumido se a senha for alterada com sucesso
 * 2. Se qualquer etapa falhar, o token não é consumido e pode ser reutilizado
 * 3. Revogação de sessões acontece na mesma transação
 */
export async function completeFirstAccess(input: unknown) {
  return handleAction(async () => {
    const data = firstAccessSchema.parse(input);
    
    // Usa transação atômica para garantir que o token só seja consumido
    // se a senha for alterada com sucesso. Se qualquer etapa falhar,
    // o token não é consumido e pode ser reutilizado.
    await prisma.$transaction(async (tx) => {
      // Consome o token de primeiro acesso (uso único, dentro da transação)
      const { userId } = await consumeAccountToken(data.token, 'FIRST_ACCESS', tx);
      
      // Verifica se o usuário existe
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new AppError("NOT_FOUND", "Usuário não encontrado.", 404);
      }
      
      // Atualiza a senha do usuário
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: await hashPassword(data.password) },
      });
      
      // Revoga todas as sessões ativas (segurança, embora improvável ter sessões ainda)
      await tx.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
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