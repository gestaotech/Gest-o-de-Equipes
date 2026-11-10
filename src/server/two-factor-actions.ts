"use server";

import { prisma } from "@/lib/prisma";
import { handleAction, AppError, ok } from "@/lib/errors";
import { requireSessionApi } from "@/lib/auth";
import { createHmac, randomBytes } from "crypto";
import { encrypt, decrypt } from "@/lib/encryption";

// Tabela Base32 (RFC 4648)
const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Uint8Array {
  const clean = input.replace(/[^A-Z2-7]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_CHARS.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

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
 * Gera códigos de backup (8 códigos de 8 dígitos hexadecimais).
 * Retorna os códigos em texto puro APENAS uma vez (para exibição ao usuário).
 * Após isso, apenas o hash é armazenado.
 */
function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    codes.push(randomBytes(4).toString("hex").toUpperCase());
  }
  return codes;
}

/**
 * Gera hash SHA-256 de um código de backup para armazenamento seguro.
 * O código em texto puro nunca é persistido.
 */
function hashBackupCode(code: string): string {
  return createHmac("sha256", process.env.ENCRYPTION_HMAC_KEY || "fallback").update(code).digest("hex");
}

/**
 * Valida um código TOTP de 6 dígitos contra o segredo base32.
 * Implementa RFC 6238 (TOTP) e RFC 4226 (HOTP) corretamente usando HMAC-SHA1.
 *
 * @param secretBase32 - Segredo base32 do usuário
 * @param token - Código de 6 dígitos informado pelo usuário
 * @param window - Janela de tolerância em passos de 30s (padrão: 1 passo antes e 1 depois)
 * @returns true se o token é válido
 */
export async function validateTOTP(secretBase32: string, token: string, window = 1): Promise<boolean> {
  try {
    // Valida formato do token: exatamente 6 dígitos
    if (!/^\d{6}$/.test(token)) {
      return false;
    }

    const decoded = base32Decode(secretBase32);
    const timeNow = Math.floor(Date.now() / 1000 / 30);

    // Tenta o time step atual e janela de tolerância
    for (let offset = -window; offset <= window; offset++) {
      const timeStep = timeNow + offset;
      const buffer = Buffer.alloc(8);
      buffer.writeBigInt64BE(BigInt(timeStep));

      // HMAC-SHA1 conforme RFC 4226
      const hmac = createHmac("sha1", Buffer.from(decoded)).update(buffer).digest();

      // Dynamic truncation (RFC 4226)
      const offsetByte = hmac[hmac.length - 1] & 0x0f;
      const binary =
        ((hmac[offsetByte] & 0x7f) << 24) |
        ((hmac[offsetByte + 1] & 0xff) << 16) |
        ((hmac[offsetByte + 2] & 0xff) << 8) |
        (hmac[offsetByte + 3] & 0xff);

      const otp = (binary % 1_000_000).toString().padStart(6, "0");
      if (otp === token) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Valida um código de backup contra o hash armazenado.
 * O código é consumido (marcado como usado) após validação bem-sucedida.
 */
export async function validateBackupCode(code: string, storedHashes: string[]): Promise<{ valid: boolean; remainingHashes: string[] }> {
  const codeHash = hashBackupCode(code);
  const codeIndex = storedHashes.indexOf(codeHash);
  if (codeIndex === -1) {
    return { valid: false, remainingHashes: storedHashes };
  }
  // Remove o código usado (uso único)
  const remainingHashes = storedHashes.filter((_, idx) => idx !== codeIndex);
  return { valid: true, remainingHashes };
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
    const backupCodesHash = backupCodes.map((c) => hashBackupCode(c));

    // Criptografar o segredo TOTP antes de armazenar
    const secretEncrypted = await encrypt(secret);

    await prisma.userTwoFactor.upsert({
      where: { userId: session.sub },
      create: {
        userId: session.sub,
        enabled: false,
        secretEncrypted,
        backupCodesHash: JSON.stringify(backupCodesHash),
      },
      update: {
        secretEncrypted,
        backupCodesHash: JSON.stringify(backupCodesHash),
        enabled: false, // Requer confirmação com primeiro código
      },
    });

    // Retorna o segredo e os códigos de backup APENAS uma vez
    // Após isso, o segredo está criptografado no banco e os códigos de backup
    // existem apenas como hash
    return ok({
      secret,
      backupCodes,
      otpauthUrl: `otpauth://totp/TeamFlow:${session.email}?secret=${secret}&issuer=TeamFlow`,
      warning: "Guarde os códigos de backup em local seguro. Eles serão exibidos apenas esta vez.",
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
    if (!tfa || !tfa.secretEncrypted) {
      throw new AppError("NOT_FOUND", "Configuração de 2FA não encontrada. Execute o setup primeiro.", 404);
    }
    if (tfa.enabled) {
      throw new AppError("EXISTS", "2FA já está ativado para este usuário.", 409);
    }

    // Descriptografar o segredo para validar o código
    const secret = await decrypt(tfa.secretEncrypted);

    if (!(await validateTOTP(secret, token, 1))) {
      throw new AppError("INVALID_TOKEN", "Código inválido.", 400);
    }

    // Ativar 2FA apenas após validação bem-sucedida do código
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
      select: { backupCodesHash: true, enabled: true },
    });
    if (!tfa?.enabled) {
      throw new AppError("NOT_FOUND", "2FA não está ativado.", 404);
    }

    // NÃO retornar os códigos de backup - eles são apenas hashes
    // O usuário deve tê-los guardado do momento da ativação
    return ok({
      backupCodesCount: JSON.parse(tfa.backupCodesHash || "[]").length,
      message: "Os códigos de backup são exibidos apenas no momento da ativação. Guarde-os em local seguro.",
    });
  });
}

export async function verifyTwoFactorToken(input: { token: string }) {
  return handleAction(async () => {
    const session = await requireSessionApi();

    const tfa = await prisma.userTwoFactor.findUnique({
      where: { userId: session.sub },
    });
    if (!tfa?.enabled || !tfa.secretEncrypted) {
      throw new AppError("NOT_FOUND", "2FA não está ativado.", 404);
    }

    // Descriptografar o segredo para validação
    const secret = await decrypt(tfa.secretEncrypted);

    // Tenta como código TOTP
    if (await validateTOTP(secret, input.token, 1)) {
      return ok({ valid: true, type: "totp" });
    }

    // Tenta como código de backup (uso único)
    const codesHash: string[] = JSON.parse(tfa.backupCodesHash || "[]");
    const result = await validateBackupCode(input.token.trim(), codesHash);
    if (result.valid) {
      // Atualizar os hashes removendo o código usado
      await prisma.userTwoFactor.update({
        where: { userId: session.sub },
        data: { backupCodesHash: JSON.stringify(result.remainingHashes) },
      });
      return ok({ valid: true, type: "backup" });
    }

    throw new AppError("INVALID_TOKEN", "Código inválido.", 400);
  });
}
