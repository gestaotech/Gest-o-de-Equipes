import { describe, it, expect } from "vitest";
import {
  profileSchema,
  passwordChangeSchema,
  signUpSchema,
} from "@/lib/validations";

describe("profileSchema (anti mass-assignment)", () => {
  it("aceita nome e telefone", () => {
    const res = profileSchema.safeParse({
      name: "Maria Silva",
      phone: "(11) 99999-9999",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.name).toBe("Maria Silva");
      expect(res.data.phone).toBe("(11) 99999-9999");
    }
  });

  it("aceita telefone nulo", () => {
    const res = profileSchema.safeParse({ name: "Maria", phone: null });
    expect(res.success).toBe(true);
  });

  it("rejeita nome curto", () => {
    expect(profileSchema.safeParse({ name: "M" }).success).toBe(false);
  });

  it("rejeita telefone inválido", () => {
    expect(
      profileSchema.safeParse({ name: "Maria", phone: "abcde" }).success
    ).toBe(false);
  });

  it("descarta campos privilegiados (role/orgId/status)", () => {
    const res = profileSchema.safeParse({
      name: "Maria",
      phone: null,
      role: "OWNER",
      organizationId: "org-x",
      status: "ADMIN",
      teamId: "t1",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).not.toHaveProperty("role");
      expect(res.data).not.toHaveProperty("organizationId");
      expect(res.data).not.toHaveProperty("status");
    }
  });
});

describe("passwordChangeSchema", () => {
  it("aceita senha válida", () => {
    const res = passwordChangeSchema.safeParse({
      currentPassword: "senha-atual",
      newPassword: "nova-senha-123",
      confirm: "nova-senha-123",
    });
    expect(res.success).toBe(true);
  });

  it("rejeita confirmação divergente", () => {
    const res = passwordChangeSchema.safeParse({
      currentPassword: "senha-atual",
      newPassword: "nova-senha-123",
      confirm: "outra-senha",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0].path[0]).toBe("confirm");
  });

  it("rejeita nova senha curta (min 8)", () => {
    const res = passwordChangeSchema.safeParse({
      currentPassword: "senha-atual",
      newPassword: "1234567",
      confirm: "1234567",
    });
    expect(res.success).toBe(false);
  });

  it("rejeita nova senha igual à atual", () => {
    const res = passwordChangeSchema.safeParse({
      currentPassword: "mesma-senha",
      newPassword: "mesma-senha",
      confirm: "mesma-senha",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0].path[0]).toBe("newPassword");
  });
});

describe("política de senha (cadastro)", () => {
  it("aplica mínimo de 8 caracteres no cadastro", () => {
    expect(
      signUpSchema.safeParse({
        name: "João",
        email: "joao@ex.com",
        password: "1234567",
      }).success
    ).toBe(false);
    expect(
      signUpSchema.safeParse({
        name: "João",
        email: "joao@ex.com",
        password: "12345678",
      }).success
    ).toBe(true);
  });
});