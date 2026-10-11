/**
 * Tokens de conta (primeiro acesso / recuperação de senha).
 *
 * Módulo SEM dependência de Prisma para ser testável de forma pura.
 * Regras de segurança aplicadas aqui:
 *  - O token bruto só existe na memória; o banco guarda apenas o HASH (sha256).
 *  - Validade explícita (`expiresAt`).
 *  - Uso único (`usedAt`): uma vez consumido, não pode ser reutilizado.
 */
import { randomBytes, createHash } from "crypto";

/** Validade padrão do link de primeiro acesso: 24 horas. */
export const ACCOUNT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** Tamanho do token em bytes (256 bits de entropia). */
const TOKEN_BYTES = 32;

export type AccountTokenView = {
  usedAt: Date | null;
  expiresAt: Date;
};

/** Gera um token criptograficamente seguro (nunca armazenado em texto puro). */
export function generateAccountToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Hash determinístico usado para persistir/consultar o token. */
export function hashAccountToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Calcula a data de expiração a partir de agora. */
export function tokenExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + ACCOUNT_TOKEN_TTL_MS);
}

/** Um token só é utilizável se não foi usado e ainda não expirou. */
export function isTokenUsable(token: AccountTokenView, now: Date = new Date()): boolean {
  if (token.usedAt) return false;
  return token.expiresAt.getTime() > now.getTime();
}
