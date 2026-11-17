import { describe, it, expect, vi, beforeEach } from "vitest";

const store = vi.hoisted(() => ({ records: new Map<string, { count: number; resetAt: Date }>() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    rateLimitRecord: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) => store.records.get(where.key) ?? null),
      upsert: vi.fn(async ({ where, create }: { where: { key: string }; create: { count: number; resetAt: Date } }) => {
        store.records.set(where.key, { count: create.count, resetAt: create.resetAt });
      }),
      update: vi.fn(async ({ where }: { where: { key: string } }) => {
        const r = store.records.get(where.key)!;
        r.count += 1;
      }),
      deleteMany: vi.fn(async ({ where }: { where: { key: string } }) => {
        store.records.delete(where.key);
      }),
    },
  },
}));

import { consumeAttempt, resetAttempts } from "./db-rate-limit";

describe("consumeAttempt", () => {
  beforeEach(() => store.records.clear());

  it("permite tentativas até o limite e bloqueia a seguinte", async () => {
    for (let i = 0; i < 5; i++) await consumeAttempt("k", 5, 60_000);
    await expect(consumeAttempt("k", 5, 60_000)).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });

  it("reinicia a janela após expirar", async () => {
    for (let i = 0; i < 5; i++) await consumeAttempt("k", 5, 60_000);
    store.records.get("k")!.resetAt = new Date(Date.now() - 1);
    await expect(consumeAttempt("k", 5, 60_000)).resolves.toBeUndefined();
  });

  it("resetAttempts libera o limite imediatamente", async () => {
    for (let i = 0; i < 5; i++) await consumeAttempt("k", 5, 60_000);
    await resetAttempts("k");
    await expect(consumeAttempt("k", 5, 60_000)).resolves.toBeUndefined();
  });
});
