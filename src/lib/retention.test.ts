import { describe, it, expect } from "vitest";
import { isExecutableRetentionPolicy, retentionCutoff, MIN_RETENTION_DAYS } from "./retention";

const base = { entityType: "activity_logs", action: "DELETE", retentionDays: 365, isActive: true };

describe("isExecutableRetentionPolicy", () => {
  it("aceita política ativa de tipo suportado, ação DELETE e prazo válido", () => {
    expect(isExecutableRetentionPolicy(base)).toBe(true);
    expect(isExecutableRetentionPolicy({ ...base, entityType: "notifications" })).toBe(true);
  });

  it("ignora política inativa", () => {
    expect(isExecutableRetentionPolicy({ ...base, isActive: false })).toBe(false);
  });

  it("ignora tipo de entidade não suportado", () => {
    expect(isExecutableRetentionPolicy({ ...base, entityType: "tasks" })).toBe(false);
  });

  it("ignora ação diferente de DELETE", () => {
    expect(isExecutableRetentionPolicy({ ...base, action: "ANONYMIZE" })).toBe(false);
  });

  it("ignora prazo abaixo do mínimo", () => {
    expect(isExecutableRetentionPolicy({ ...base, retentionDays: MIN_RETENTION_DAYS - 1 })).toBe(false);
  });
});

describe("retentionCutoff", () => {
  it("calcula a data de corte em dias", () => {
    const now = new Date("2026-11-12T12:00:00Z");
    expect(retentionCutoff(30, now).toISOString()).toBe("2026-10-13T12:00:00.000Z");
  });
});
