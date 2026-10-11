import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { prisma } from "@/lib/prisma";
import { issueAccountToken, consumeAccountToken } from "@/server/account-token";
import { hashAccountToken } from "@/lib/account-token";
import { AppError } from "@/lib/errors";

vi.mock("@prisma/client", () => ({
  Prisma: { PrismaClientKnownRequestError: class {} },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accountToken: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

const table = prisma.accountToken as unknown as {
  findUnique: Mock;
  updateMany: Mock;
  create: Mock;
};

const future = () => new Date(Date.now() + 60_000);
const past = () => new Date(Date.now() - 60_000);

describe("issueAccountToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rotaciona tokens anteriores e persiste apenas o hash", async () => {
    table.updateMany.mockResolvedValue({ count: 1 });
    table.create.mockResolvedValue({});

    const raw = await issueAccountToken("user-1", "FIRST_ACCESS");

    expect(table.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", type: "FIRST_ACCESS", usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    const created = table.create.mock.calls[0][0].data;
    expect(created.userId).toBe("user-1");
    expect(created.type).toBe("FIRST_ACCESS");
    expect(created.tokenHash).toBe(hashAccountToken(raw));
    expect(created.tokenHash).not.toBe(raw);
    expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("consumeAccountToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("aceita token válido e marca como usado (uso único)", async () => {
    table.findUnique.mockResolvedValue({
      id: "t1",
      userId: "user-1",
      type: "FIRST_ACCESS",
      usedAt: null,
      expiresAt: future(),
    });
    table.updateMany.mockResolvedValue({ count: 1 });

    const res = await consumeAccountToken("raw-token", "FIRST_ACCESS");

    expect(res).toEqual({ userId: "user-1" });
    expect(table.updateMany).toHaveBeenCalledWith({
      where: { id: "t1", usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
  });

  it("rejeita token inexistente", async () => {
    table.findUnique.mockResolvedValue(null);
    await expect(consumeAccountToken("raw", "FIRST_ACCESS")).rejects.toBeInstanceOf(AppError);
  });

  it("rejeita token expirado e não o consome", async () => {
    table.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u",
      type: "FIRST_ACCESS",
      usedAt: null,
      expiresAt: past(),
    });
    await expect(consumeAccountToken("raw", "FIRST_ACCESS")).rejects.toBeInstanceOf(AppError);
    expect(table.updateMany).not.toHaveBeenCalled();
  });

  it("rejeita token já utilizado", async () => {
    table.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u",
      type: "FIRST_ACCESS",
      usedAt: new Date(),
      expiresAt: future(),
    });
    await expect(consumeAccountToken("raw", "FIRST_ACCESS")).rejects.toBeInstanceOf(AppError);
  });

  it("rejeita token de tipo divergente", async () => {
    table.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u",
      type: "PASSWORD_RESET",
      usedAt: null,
      expiresAt: future(),
    });
    await expect(consumeAccountToken("raw", "FIRST_ACCESS")).rejects.toBeInstanceOf(AppError);
  });

  it("rejeita quando a marcação concorrente falha", async () => {
    table.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u",
      type: "FIRST_ACCESS",
      usedAt: null,
      expiresAt: future(),
    });
    table.updateMany.mockResolvedValue({ count: 0 });
    await expect(consumeAccountToken("raw", "FIRST_ACCESS")).rejects.toBeInstanceOf(AppError);
  });

  it("rejeita token vazio sem consultar o banco", async () => {
    await expect(consumeAccountToken("", "FIRST_ACCESS")).rejects.toBeInstanceOf(AppError);
    expect(table.findUnique).not.toHaveBeenCalled();
  });
});
