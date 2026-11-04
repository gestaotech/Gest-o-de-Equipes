import "server-only";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import {
  generateAccountToken,
  hashAccountToken,
  tokenExpiresAt,
  isTokenUsable,
} from "@/lib/account-token";
import type { Prisma, AccountTokenType } from "@prisma/client";

type Client = Prisma.TransactionClient | typeof prisma;

/**
 * Emite um novo token de conta para o usuário e devolve o token BRUTO.
 *
 * - Persiste apenas o HASH (sha256) — o valor bruto nunca toca o banco.
 * - Rotaciona: invalida tokens anteriores do mesmo tipo ainda não usados,
 *   de modo que apenas o último link gerado funcione.
 *
 * O retorno deve ser entregue ao usuário (e-mail) e nunca registrado em log.
 */
export async function issueAccountToken(
  userId: string,
  type: AccountTokenType,
  client: Client = prisma
): Promise<string> {
  await client.accountToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });
  const raw = generateAccountToken();
  await client.accountToken.create({
    data: {
      userId,
      type,
      tokenHash: hashAccountToken(raw),
      expiresAt: tokenExpiresAt(),
    },
  });
  return raw;
}

/**
 * Consome um token de conta: valida existência, tipo, validade e uso único,
 * marcando-o como usado. Lança erro GENÉRICO (sem vazar detalhes) quando
 * o link for inválido, expirado ou já utilizado.
 *
 * Aceita um client transacional opcional para garantir atomicidade em operações
 * que dependem do consumo do token (ex: alteração de senha).
 */
export async function consumeAccountToken(
  rawToken: string,
  type: AccountTokenType,
  client: Client = prisma
): Promise<{ userId: string }> {
  if (!rawToken) {
    throw new AppError("INVALID_TOKEN", "Link inválido ou expirado.", 400);
  }
  const token = await client.accountToken.findUnique({
    where: { tokenHash: hashAccountToken(rawToken) },
  });
  if (!token || token.type !== type || !isTokenUsable(token)) {
    throw new AppError("INVALID_TOKEN", "Link inválido ou expirado.", 400);
  }
  // Marcação condicional: garante uso único mesmo sob concorrência.
  const consumed = await client.accountToken.updateMany({
    where: { id: token.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (consumed.count !== 1) {
    throw new AppError("INVALID_TOKEN", "Link inválido ou expirado.", 400);
  }
  return { userId: token.userId };
}
