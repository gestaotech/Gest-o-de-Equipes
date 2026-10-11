import { describe, it, expect } from "vitest";
import {
  ACCOUNT_TOKEN_TTL_MS,
  generateAccountToken,
  hashAccountToken,
  tokenExpiresAt,
  isTokenUsable,
} from "@/lib/account-token";

describe("generateAccountToken", () => {
  it("gera tokens distintos e com entropia suficiente", () => {
    const a = generateAccountToken();
    const b = generateAccountToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("hashAccountToken", () => {
  it("é determinístico e produz sha256 em hex (nunca o valor bruto)", () => {
    const raw = "token-secreto";
    const h1 = hashAccountToken(raw);
    const h2 = hashAccountToken(raw);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
    expect(h1).not.toContain(raw);
  });
});

describe("tokenExpiresAt", () => {
  it("define a expiração dentro da janela de validade", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const exp = tokenExpiresAt(now);
    expect(exp.getTime() - now.getTime()).toBe(ACCOUNT_TOKEN_TTL_MS);
  });
});

describe("isTokenUsable", () => {
  const now = new Date("2026-01-01T12:00:00.000Z");

  it("aceita token não usado e dentro da validade", () => {
    expect(
      isTokenUsable({ usedAt: null, expiresAt: new Date("2026-01-02T00:00:00.000Z") }, now)
    ).toBe(true);
  });

  it("rejeita token já utilizado (uso único)", () => {
    expect(
      isTokenUsable(
        { usedAt: new Date("2026-01-01T10:00:00.000Z"), expiresAt: new Date("2026-01-02T00:00:00.000Z") },
        now
      )
    ).toBe(false);
  });

  it("rejeita token expirado", () => {
    expect(
      isTokenUsable({ usedAt: null, expiresAt: new Date("2026-01-01T11:00:00.000Z") }, now)
    ).toBe(false);
  });
});
