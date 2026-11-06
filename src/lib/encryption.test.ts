import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  encrypt,
  decrypt,
  maskCpf,
  maskPhone,
  maskEmail,
  generateHmacIndex,
  isEncrypted,
} from "@/lib/encryption";
import { sanitizeAuditData, containsSensitiveData } from "@/lib/audit-sanitizer";

vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("crypto")>();
  let counter = 0;
  return {
    ...actual,
    randomBytes: vi.fn((size) => {
      counter++;
      const buf = Buffer.alloc(size, counter % 256);
      return buf;
    }),
  };
});

describe("Criptografia (LGPD - Fase 1)", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "test-encryption-key-32-chars-long!!";
    process.env.ENCRYPTION_HMAC_KEY = "test-hmac-key-32-chars-long!!";
  });

  it("criptografa e descriptografa corretamente", async () => {
    const original = "123.456.789-01";
    const encrypted = await encrypt(original);
    const decrypted = await decrypt(encrypted);

    expect(encrypted).not.toBe(original);
    expect(decrypted).toBe(original);
  });

  it("não armazena texto puro", async () => {
    const original = "senha-sensível-123";
    const encrypted = await encrypt(original);

    expect(encrypted).not.toContain(original);
    expect(encrypted.length).toBeGreaterThan(original.length);
  });

  it("gera dados diferentes para mesma entrada (IV aleatório)", async () => {
    const original = "valor-teste";
    const encrypted1 = await encrypt(original);
    const encrypted2 = await encrypt(original);

    expect(encrypted1).not.toBe(encrypted2);
  });

  it("detecta dados criptografados", async () => {
    const plaintext = "texto-puro";
    const encrypted = await encrypt(plaintext);

    expect(isEncrypted(plaintext)).toBe(false);
    expect(isEncrypted(encrypted)).toBe(true);
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted(undefined)).toBe(false);
    expect(isEncrypted("")).toBe(false);
  });

  it("rejeita descriptografia de formato inválido", async () => {
    await expect(decrypt("formato-invalido")).rejects.toThrow();
  });
});

describe("Mascaramento de dados (LGPD - Fase 1)", () => {
  it("mascara CPF mostrando apenas últimos 2 dígitos", () => {
    expect(maskCpf("123.456.789-01")).toBe("***.456.***-**-01");
    expect(maskCpf("12345678901")).toBe("***.456.***-**-01");
    expect(maskCpf(null)).toBeNull();
    expect(maskCpf(undefined)).toBeUndefined();
    expect(maskCpf("")).toBe("");
  });

  it("mascara telefone mostrando DDD e últimos 4 dígitos", () => {
    expect(maskPhone("(11) 98765-4321")).toBe("(11) ****-4321");
    expect(maskCpf(null)).toBeNull();
  });

  it("mascara e-mail mostrando primeira letra e domínio", () => {
    expect(maskEmail("joao@empresa.com")).toBe("j***@empresa.com");
    expect(maskEmail(null)).toBeNull();
  });
});

describe("HMAC para índice de busca (LGPD - Fase 3.1)", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_HMAC_KEY = "test-hmac-key-32-chars-long!!";
  });

  it("gera HMAC determinístico para mesmo valor", () => {
    const hmac1 = generateHmacIndex("123.456.789-01");
    const hmac2 = generateHmacIndex("123.456.789-01");

    expect(hmac1).toBe(hmac2);
    expect(hmac1.length).toBe(64); // SHA-256 hex
  });

  it("gera HMAC diferente para valores diferentes", () => {
    const hmac1 = generateHmacIndex("123.456.789-01");
    const hmac2 = generateHmacIndex("987.654.321-00");

    expect(hmac1).not.toBe(hmac2);
  });

  it("é case-insensitive", () => {
    const hmac1 = generateHmacIndex("JOAO@EMPRESA.COM");
    const hmac2 = generateHmacIndex("joao@empresa.com");

    expect(hmac1).toBe(hmac2);
  });
});

describe("Sanitização de logs (LGPD - Fase 2)", () => {
  it("remove senhas dos logs", () => {
    const data = { user: "joao", password: "senha123", email: "joao@test.com" };
    const result = sanitizeAuditData(data);

    expect((result as Record<string, unknown>).password).toBe("[REDACTED]");
  });

  it("remove tokens de autenticação", () => {
    const data = {
      userId: "user-1",
      sessionToken: "abc-123-token",
      accessToken: "xyz-789-token",
    };
    const result = sanitizeAuditData(data);

    expect((result as Record<string, unknown>).sessionToken).toBe("[REDACTED]");
    expect((result as Record<string, unknown>).accessToken).toBe("[REDACTED]");
  });

  it("remove chaves de API", () => {
    const data = { apiKey: "sk-1234567890", apiSecret: "secret-value" };
    const result = sanitizeAuditData(data);

    expect((result as Record<string, unknown>).apiKey).toBe("[REDACTED]");
    expect((result as Record<string, unknown>).apiSecret).toBe("[REDACTED]");
  });

  it("mascara e-mail nos logs", () => {
    const data = { user: "joao", email: "joao.silva@empresa.com" };
    const result = sanitizeAuditData(data);

    expect((result as Record<string, unknown>).email).toBe("j***@empresa.com");
  });

  it("mascara CPF nos logs", () => {
    const data = { cpf: "123.456.789-01", user: "joao" };
    const result = sanitizeAuditData(data);

    expect((result as Record<string, unknown>).cpf).toBe("***.456.***-**-01");
  });

  it("mascara telefone nos logs", () => {
    const data = { phone: "(11) 98765-4321" };
    const result = sanitizeAuditData(data);

    expect((result as Record<string, unknown>).phone).toBe("(11) ****-4321");
  });

  it("detecta dados sensíveis antes do log", () => {
    const safe = { user: "joao", action: "login" };
    const sensitive = { user: "joao", password: "senha123" };

    expect(containsSensitiveData(safe)).toBe(false);
    expect(containsSensitiveData(sensitive)).toBe(true);
  });

  it("sanitiza objetos aninhados", () => {
    const data = {
      user: {
        name: "João Silva",
        email: "joao@empresa.com",
        password: "secret123",
      },
    };
    const result = sanitizeAuditData(data) as Record<string, unknown>;
    const user = result.user as Record<string, unknown>;

    expect(user.name).toBe("J***");
    expect(user.email).toBe("j***@empresa.com");
    expect(user.password).toBe("[REDACTED]");
  });

  it("sanitiza arrays de objetos", () => {
    const data = {
      users: [
        { name: "João", email: "joao@test.com", password: "secret1" },
        { name: "Maria", email: "maria@test.com", password: "secret2" },
      ],
    };
    const result = sanitizeAuditData(data) as Record<string, unknown>;
    const users = result.users as Record<string, unknown>[];

    expect(users[0].name).toBe("J***");
    expect(users[0].email).toBe("j***@test.com");
    expect(users[0].password).toBe("[REDACTED]");
    expect(users[1].name).toBe("M***");
    expect(users[1].email).toBe("m***@test.com");
    expect(users[1].password).toBe("[REDACTED]");
  });
});
