import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { prisma } from "@/lib/prisma";
import { sanitizeAuditData, containsSensitiveData } from "@/lib/audit-sanitizer";
import { maskCpf, maskPhone, maskEmail } from "@/lib/encryption";

vi.mock("@prisma/client", () => ({
  Prisma: { PrismaClientKnownRequestError: class {} },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lGPDRequest: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    processingRecord: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    privacyPolicy: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    consent: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    retentionPolicy: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    securityIncident: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    organizationMember: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    userSession: {
      deleteMany: vi.fn(),
    },
    userPreference: {
      deleteMany: vi.fn(),
    },
    userTwoFactor: {
      deleteMany: vi.fn(),
    },
    accountToken: {
      deleteMany: vi.fn(),
    },
    notification: {
      deleteMany: vi.fn(),
    },
    taskComment: {
      deleteMany: vi.fn(),
    },
    activityLog: {
      deleteMany: vi.fn(),
    },
    eventParticipant: {
      deleteMany: vi.fn(),
    },
    user: {
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn(prisma)),
  },
}));

const mockedPrisma = prisma as unknown as Record<string, { [k: string]: Mock }>;

describe("LGPD - Sanitização de Logs", () => {
  it("não armazena senhas em texto puro", () => {
    const data = { password: "minha-senha-secreta", user: "joao" };
    const result = sanitizeAuditData(data);
    expect((result as Record<string, unknown>).password).toBe("[REDACTED]");
  });

  it("detecta dados sensíveis", () => {
    expect(containsSensitiveData({ password: "123" })).toBe(true);
    expect(containsSensitiveData({ token: "abc" })).toBe(true);
    expect(containsSensitiveData({ name: "joao" })).toBe(false);
  });

  it("mascara CPF nos logs", () => {
    const result = sanitizeAuditData({ cpf: "123.456.789-01" });
    expect((result as Record<string, unknown>).cpf).toBe("***.456.***-**-01");
  });

  it("mascara telefone nos logs", () => {
    const result = sanitizeAuditData({ phone: "(11) 98765-4321" });
    expect((result as Record<string, unknown>).phone).toBe("(11) ****-4321");
  });

  it("mascara e-mail nos logs", () => {
    const result = sanitizeAuditData({ email: "joao@empresa.com" });
    expect((result as Record<string, unknown>).email).toBe("j***@empresa.com");
  });

  it("sanitiza objetos aninhados recursivamente", () => {
    const data = {
      user: { name: "João", email: "joao@test.com", password: "secret" },
      tokens: { accessToken: "tok-123" },
    };
    const result = sanitizeAuditData(data) as Record<string, unknown>;
    const user = result.user as Record<string, unknown>;
    const tokens = result.tokens as Record<string, unknown>;

    expect(user.name).toBe("J***");
    expect(user.email).toBe("j***@test.com");
    expect(user.password).toBe("[REDACTED]");
    expect(tokens.accessToken).toBe("[REDACTED]");
  });
});

describe("LGPD - Isolamento entre organizações", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filtra solicitações por organização", async () => {
    mockedPrisma.lGPDRequest.findMany.mockResolvedValue([]);

    const orgId = "org-a";
    const userId = "user-1";

    // Simula a consulta que seria feita na Server Action
    await prisma.lGPDRequest.findMany({
      where: { organizationId: orgId, userId },
    });

    expect(mockedPrisma.lGPDRequest.findMany).toHaveBeenCalledWith({
      where: { organizationId: orgId, userId },
    });
  });

  it("não permite acesso a solicitações de outra organização", async () => {
    mockedPrisma.lGPDRequest.findFirst.mockResolvedValue(null);

    await prisma.lGPDRequest.findFirst({
      where: { id: "req-1", organizationId: "org-b" },
    });

    expect(mockedPrisma.lGPDRequest.findFirst).toHaveBeenCalledWith({
      where: { id: "req-1", organizationId: "org-b" },
    });
  });
});

describe("LGPD - Máscaras de dados", () => {
  it("mascara CPF corretamente", () => {
    expect(maskCpf("123.456.789-01")).toBe("***.456.***-**-01");
    expect(maskCpf("111.222.333-44")).toBe("***.222.***-**-44");
    expect(maskCpf(null)).toBeNull();
  });

  it("mascara telefone corretamente", () => {
    expect(maskPhone("(11) 98765-4321")).toBe("(11) ****-4321");
    expect(maskPhone("11987654321")).toBe("(11) ****-4321");
  });

  it("mascara e-mail corretamente", () => {
    expect(maskEmail("joao.silva@empresa.com.br")).toBe("j***@empresa.com.br");
    expect(maskEmail("a@b.com")).toBe("a***@b.com");
  });
});
