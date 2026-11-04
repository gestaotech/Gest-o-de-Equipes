import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { prisma } from "@/lib/prisma";
import { requestReset, resetPassword, completeFirstAccess } from "@/server/auth-actions";
import { AppError } from "@/lib/errors";

vi.mock("@prisma/client", () => ({
  Prisma: { PrismaClientKnownRequestError: class {} },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    userSession: {
      updateMany: vi.fn(),
    },
    accountToken: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn(prisma)),
  },
}));

vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-password"),
}));

const mockedPrisma = prisma as unknown as {
  user: {
    findUnique: Mock;
    update: Mock;
  };
  userSession: {
    updateMany: Mock;
  };
  accountToken: {
    findUnique: Mock;
    updateMany: Mock;
    create: Mock;
  };
  $transaction: Mock;
};

const { sendPasswordResetEmail } = await import("@/lib/email");

const future = () => new Date(Date.now() + 60_000);

describe("requestReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não vaza existência de e-mail inexistente", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    const result = await requestReset({ email: "nao-existe@example.com" });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ sent: true });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("gera token e envia e-mail quando usuário existe", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "existe@example.com",
    });
    mockedPrisma.accountToken.updateMany.mockResolvedValue({ count: 0 });
    mockedPrisma.accountToken.create.mockResolvedValue({});

    const result = await requestReset({ email: "existe@example.com" });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ sent: true });
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      "existe@example.com",
      expect.any(String)
    );
  });

  it("normaliza e-mail para lowercase", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
    });
    mockedPrisma.accountToken.updateMany.mockResolvedValue({ count: 0 });
    mockedPrisma.accountToken.create.mockResolvedValue({});

    await requestReset({ email: "TEST@EXAMPLE.COM" });

    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "test@example.com" },
      select: { id: true, email: true },
    });
  });
});

describe("resetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejeita token inválido", async () => {
    mockedPrisma.accountToken.findUnique.mockResolvedValue(null);

    const result = await resetPassword({ token: "token-invalido", password: "NovaSenha123" });

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe("Link inválido ou expirado.");
  });

  it("rejeita token expirado", async () => {
    const past = new Date(Date.now() - 60_000);
    mockedPrisma.accountToken.findUnique.mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      type: "PASSWORD_RESET",
      usedAt: null,
      expiresAt: past,
    });

    const result = await resetPassword({ token: "token-expirado", password: "NovaSenha123" });

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe("Link inválido ou expirado.");
  });

  it("rejeita token já utilizado", async () => {
    mockedPrisma.accountToken.findUnique.mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      type: "PASSWORD_RESET",
      usedAt: new Date(),
      expiresAt: future(),
    });

    const result = await resetPassword({ token: "token-usado", password: "NovaSenha123" });

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe("Link inválido ou expirado.");
  });

  it("rejeita token de tipo incorreto", async () => {
    mockedPrisma.accountToken.findUnique.mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      type: "FIRST_ACCESS",
      usedAt: null,
      expiresAt: future(),
    });

    const result = await resetPassword({ token: "token-wrong-type", password: "NovaSenha123" });

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe("Link inválido ou expirado.");
  });

  it("executa transação atômica com sucesso", async () => {
    mockedPrisma.accountToken.findUnique.mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      type: "PASSWORD_RESET",
      usedAt: null,
      expiresAt: future(),
    });
    mockedPrisma.accountToken.updateMany.mockResolvedValue({ count: 1 });
    mockedPrisma.user.update.mockResolvedValue({});
    mockedPrisma.userSession.updateMany.mockResolvedValue({ count: 2 });

    const result = await resetPassword({ token: "token-valido", password: "NovaSenha123" });

    expect(result.success).toBe(true);
    expect(mockedPrisma.$transaction).toHaveBeenCalled();
    expect(mockedPrisma.user.update).toHaveBeenCalled();
    expect(mockedPrisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("não consome token se transação falhar", async () => {
    mockedPrisma.accountToken.findUnique.mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      type: "PASSWORD_RESET",
      usedAt: null,
      expiresAt: future(),
    });
    mockedPrisma.user.update.mockRejectedValue(new Error("Database error"));

    const result = await resetPassword({ token: "token-valido", password: "NovaSenha123" });

    expect(result.success).toBe(false);
    // Token não deve ser marcado como usado se a transação falhar
    expect(mockedPrisma.accountToken.updateMany).not.toHaveBeenCalled();
  });
});

describe("completeFirstAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejeita token inválido", async () => {
    mockedPrisma.accountToken.findUnique.mockResolvedValue(null);

    const result = await completeFirstAccess({ token: "token-invalido", password: "Senha123" });

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe("Link inválido ou expirado.");
  });

  it("rejeita token já utilizado", async () => {
    mockedPrisma.accountToken.findUnique.mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      type: "FIRST_ACCESS",
      usedAt: new Date(),
      expiresAt: future(),
    });

    const result = await completeFirstAccess({ token: "token-usado", password: "Senha123" });

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe("Link inválido ou expirado.");
  });

  it("executa transação atômica com sucesso", async () => {
    mockedPrisma.accountToken.findUnique.mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      type: "FIRST_ACCESS",
      usedAt: null,
      expiresAt: future(),
    });
    mockedPrisma.accountToken.updateMany.mockResolvedValue({ count: 1 });
    mockedPrisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "test@example.com" });
    mockedPrisma.user.update.mockResolvedValue({});
    mockedPrisma.userSession.updateMany.mockResolvedValue({ count: 0 });

    const result = await completeFirstAccess({ token: "token-valido", password: "Senha123" });

    expect(result.success).toBe(true);
    expect(mockedPrisma.$transaction).toHaveBeenCalled();
    expect(mockedPrisma.user.update).toHaveBeenCalled();
  });

  it("não consome token se usuário não existir", async () => {
    mockedPrisma.accountToken.findUnique.mockResolvedValue({
      id: "token-1",
      userId: "user-inexistente",
      type: "FIRST_ACCESS",
      usedAt: null,
      expiresAt: future(),
    });
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    const result = await completeFirstAccess({ token: "token-valido", password: "Senha123" });

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe("Usuário não encontrado.");
    // Token não deve ser consumido se o usuário não existir
    expect(mockedPrisma.accountToken.updateMany).not.toHaveBeenCalled();
  });

  it("não consome token se transação falhar", async () => {
    mockedPrisma.accountToken.findUnique.mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      type: "FIRST_ACCESS",
      usedAt: null,
      expiresAt: future(),
    });
    mockedPrisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "test@example.com" });
    mockedPrisma.user.update.mockRejectedValue(new Error("Database error"));

    const result = await completeFirstAccess({ token: "token-valido", password: "Senha123" });

    expect(result.success).toBe(false);
    // Token não deve ser consumido se a transação falhar
    expect(mockedPrisma.accountToken.updateMany).not.toHaveBeenCalled();
  });
});
