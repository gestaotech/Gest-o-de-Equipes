import "server-only";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

/**
 * Limite de tentativas persistido no banco (funciona entre instâncias serverless).
 * Cada chamada conta uma tentativa; ao exceder `max` dentro da janela, lança RATE_LIMITED.
 */
export async function consumeAttempt(key: string, max: number, windowMs: number): Promise<void> {
  const now = new Date();
  const record = await prisma.rateLimitRecord.findUnique({ where: { key } });

  if (!record || record.resetAt <= now) {
    await prisma.rateLimitRecord.upsert({
      where: { key },
      create: { key, count: 1, resetAt: new Date(now.getTime() + windowMs) },
      update: { count: 1, resetAt: new Date(now.getTime() + windowMs) },
    });
    return;
  }

  if (record.count >= max) {
    throw new AppError("RATE_LIMITED", "Muitas tentativas. Aguarde alguns minutos.", 429);
  }

  await prisma.rateLimitRecord.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
}

export async function resetAttempts(key: string): Promise<void> {
  await prisma.rateLimitRecord.deleteMany({ where: { key } });
}
