import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export function toIso(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString() : '';
}

export function jsonBody<T>(body: unknown): T {
  return (body || {}) as T;
}