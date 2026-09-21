import { describe, expect, it } from "vitest";
import { buildTaskWhere } from "./indicator-queries";

describe("buildTaskWhere", () => {
  it("sempre fixa a organização vinda da sessão (multi-tenant)", () => {
    const w = buildTaskWhere(
      { orgId: "org-sessao", period: "30d" },
      null
    );
    expect(w.organizationId).toBe("org-sessao");
  });

  it("aplica período, equipe e status quando informados", () => {
    const from = new Date("2026-09-01T00:00:00");
    const to = new Date("2026-10-01T00:00:00");
    const w = buildTaskWhere(
      { orgId: "o", period: "custom", teamId: "t1", status: "DONE" },
      { from, to }
    );
    expect(w.teamId).toBe("t1");
    expect(w.status).toBe("DONE");
    const createdAt = w.createdAt as { gte: Date; lt?: Date };
    expect(createdAt.gte).toEqual(from);
    expect(createdAt.lt).toEqual(to);
  });

  it("filtro por colaborador usa assignees (nunca campos de org)", () => {
    const w = buildTaskWhere(
      { orgId: "o", period: "7d", memberId: "m1" },
      null
    );
    expect(w.assignees).toEqual({ some: { memberId: "m1" } });
  });
});