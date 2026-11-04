"use server";

import { prisma } from "@/lib/prisma";
import { handleAction, AppError, ok } from "@/lib/errors";
import { requireSessionApi } from "@/lib/auth";
import { createHash, randomBytes } from "crypto";

/**
 * Gera um segredo base32 para TOTP (Google Authenticator, Authy, etc.)
 */
function generateBase32Secret(length = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let result = "";
  const bytes = randomBytes(length * 2);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Gera códigos de backup (8 códigos de 8 dígitos).
 */
function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    codes.push(randomBytes(4).toString("hex").toUpperCase());
  }
  return codes;
}

/**
 * Valida um código TOTP de 6 dígitos contra o segredo base32.
 * Implementação simplificada sem dependência externa.
 */
function validateTOTP(secret: string, token: string): boolean {
  try {
    // Decodifica base32
    const decoded = Buffer.from(secret, "base32");
    const timeStep = Math.floor(Date.now() / 1000 / 30);
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(timeStep));

    const hmac = createHash("sha1")
      .update(Buffer.concat([decoded, buffer]))
      .digest();

    // Dynamic truncation (RFC 4226)
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = (binary % 1_000_000).toString().padStart(6, "0");
    return otp === token;
  } catch {
    return false;
  }
}

export async function setupTwoFactor() {
  return handleAction(async () => {
    const session = await requireSessionApi();

    const existing = await prisma.userTwoFactor.findUnique({
      where: { userId: session.sub },
    });
    if (existing?.enabled) {
      throw new AppError("EXISTS", "2FA já está ativado para este usuário.", 409);
    }

    const secret = generateBase32Secret();
    const backupCodes = generateBackupCodes();

    await prisma.userTwoFactor.upsert({
      where: { userId: session.sub },
      create: {
        userId: session.sub,
        enabled: false,
        secret,
        backupCodes: JSON.stringify(backupCodes),
      },
      update: {
        secret,
        backupCodes: JSON.stringify(backupCodes),
      },
    });

    // Retorna o segredo para o usuário configurar no app autenticador
    // O backupCodes NÃO é retornado aqui; é mostrado apenas após confirmação
    return ok({
      secret,
      otpauthUrl: `otpauth://totp/TeamFlow:${session.email}?secret=${secret}&issuer=TeamFlow`,
    });
  });
}

export async function enableTwoFactor(input: { token: string }) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const { token } = input;

    const tfa = await prisma.userTwoFactor.findUnique({
      where: { userId: session.sub },
    });
    if (!tfa || !tfa.secret) {
      throw new AppError("NOT_FOUND", "Configuração de 2FA não encontrada. Execute o setup primeiro.", 404);
    }

    if (!validateTOTP(tfa.secret, token)) {
      throw new AppError("INVALID_TOKEN", "Código inválido.", 400);
    }

    await prisma.userTwoFactor.update({
      where: { userId: session.sub },
      data: { enabled: true },
    });

    return ok({ enabled: true });
  });
}

export async function disableTwoFactor(input: { password: string }) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const { password } = input;

    const tfa = await prisma.userTwoFactor.findUnique({
      where: { userId: session.sub },
    });
    if (!tfa || !tfa.enabled) {
      throw new AppError("NOT_FOUND", "2FA não está ativado.", 404);
    }

    // Verificar senha antes de desabilitar
    const { verifyPassword } = await import("@/lib/auth");
    const user = await prisma.user.findUnique({ where: { id: session.sub } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new AppError("WRONG_PASSWORD", "Senha incorreta.", 400);
    }

    await prisma.userTwoFactor.update({
      where: { userId: session.sub },
      data: { enabled: false },
    });

    return ok({ enabled: false });
  });
}

export async function getTwoFactorStatus() {
  return handleAction(async () => {
    const session = await requireSessionApi();

    const tfa = await prisma.userTwoFactor.findUnique({
      where: { userId: session.sub },
      select: { enabled: true, createdAt: true },
    });

    return ok({
      enabled: !!tfa?.enabled,
      createdAt: tfa?.createdAt ?? null,
    });
  });
}

export async function getBackupCodes() {
  return handleAction(async () => {
    const session = await requireSessionApi();

    const tfa = await prisma.userTwoFactor.findUnique({
      where: { userId: session.sub },
      select: { backupCodes: true, enabled: true },
    });
    if (!tfa?.enabled) {
      throw new AppError("NOT_FOUND", "2FA não está ativado.", 404);
    }

    const codes: string[] = JSON.parse(tfa.backupCodes);
    return ok({ backupCodes: codes });
  });
}

export async function verifyTwoFactorToken(input: { token: string }) {
  return handleAction(async () => {
    const session = await requireSessionApi();

    const tfa = await prisma.userTwoFactor.findUnique({
      where: { userId: session.sub },
    });
    if (!tfa?.enabled || !tfa.secret) {
      throw new AppError("NOT_FOUND", "2FA não está ativado.", 404);
    }

    // Tenta como código TOTP
    if (validateTOTP(tfa.secret, input.token)) {
      return ok({ valid: true, type: "totp" });
    }

    // Tenta como código de backup
    const codes: string[] = JSON.parse(tfa.backupCodes || "[]");
    const codeIndex = codes.indexOf(input.token.trim().toUpperCase());
    if (codeIndex !== -1) {
      // Remove o código de backup usado (uso único)
      codes.splice(codeIndex, 1);
      await prisma.userTwoFactor.update({
        where: { userId: session.sub },
        data: { backupCodes: JSON.stringify(codes) },
      });
      return ok({ valid: true, type: "backup" });
    }

    throw new AppError("INVALID_TOKEN", "Código inválido.", 400);
  });
}
