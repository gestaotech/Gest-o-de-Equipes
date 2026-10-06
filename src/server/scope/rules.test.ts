/**
 * Data Scope — matriz de testes obrigatória da Fase 1.1.
 *
 * Cobre:
 *  - MEMBER: projeto/tarefa/equipe/departamento/evento/anúncio/meta próprios vs de terceiros
 *  - Multi-tenant: organização A nunca acessa recurso da organização B
 *  - Roles: OWNER, ADMIN, MANAGER, LEADER, MEMBER
 *
 * As regras são puras (rules.ts), por isso não é necessário mock de banco.
 */

import { describe, it, expect } from "vitest";
import {
  activityVisibilityWhere,
  announcementVisibilityWhere,
  canAccessIndicatorsModule,
  canSeeAnnouncement,
  canSeeDepartment,
  canSeeEvent,
  canSeeGoal,
  canSeeProject,
  canSeeTask,
  canSeeTeam,
  dataScopeFrom,
  departmentVisibilityWhere,
  eventVisibilityWhere,
  goalVisibilityWhere,
  indicatorScopeFor,
  projectVisibilityWhere,
  scopeLevelForRole,
  taskVisibilityWhere,
  teamVisibilityWhere,
  visibleMembersWhere,
  type DataScope,
} from "@/server/scope/rules";
import { permits, type RoleName } from "@/lib/rbac";

// ------------------------------------------------------------
// FIXTURES
// ------------------------------------------------------------

const ORG_A = "org-a";
const ORG_B = "org-b";

/** Usuário A: MEMBER da organização A. */
const memberA: DataScope = dataScopeFrom({
  orgId: ORG_A,
  userId: "user-a",
  memberId: "member-a",
  role: "MEMBER",
  departmentId: "dep-a",
});

/** Usuário A1: LEADER da equipe T1 na organização A. */
const leaderA: DataScope = {
  ...dataScopeFrom({
    orgId: ORG_A,
    userId: "user-a1",
    memberId: "member-a1",
    role: "LEADER",
    departmentId: "dep-a",
  }),
  teamIds: ["team-1"],
  ledTeamIds: ["team-1"],
};

/** Usuário A2: MEMBER da organização B (outro tenant). */
const memberB: DataScope = dataScopeFrom({
  orgId: ORG_B,
  userId: "user-b",
  memberId: "member-b",
  role: "MEMBER",
  departmentId: "dep-b",
});

const asRole = (role: RoleName, over: Partial<DataScope> = {}): DataScope => ({
  ...dataScopeFrom({ orgId: ORG_A, userId: "user-a", memberId: "member-a", role }),
  ...over,
});

// IDs de recursos
const OTHER_PROJECT = "proj-other";

describe("Data Scope — nível por papel", () => {
  it("OWNER/ADMIN/MANAGER têm escopo organizacional", () => {
    expect(scopeLevelForRole("OWNER")).toBe("ORG");
    expect(scopeLevelForRole("ADMIN")).toBe("ORG");
    expect(scopeLevelForRole("MANAGER")).toBe("ORG");
  });

  it("LEADER tem escopo de liderança e MEMBER escopo pessoal", () => {
    expect(scopeLevelForRole("LEADER")).toBe("LEAD");
    expect(scopeLevelForRole("MEMBER")).toBe("SELF");
  });
});

// ------------------------------------------------------------
// MEMBER
// ------------------------------------------------------------

describe("MEMBER — projetos", () => {
  it("acessa o projeto do qual participa", () => {
    expect(
      canSeeProject(memberA, {
        organizationId: ORG_A,
        memberIds: ["member-a", "member-x"],
      })
    ).toBe(true);
  });

  it("acessa o projeto do qual é responsável", () => {
    expect(
      canSeeProject(memberA, { organizationId: ORG_A, responsibleId: "member-a" })
    ).toBe(true);
  });

  it("NÃO acessa projeto de outra equipe", () => {
    expect(
      canSeeProject(memberA, {
        organizationId: ORG_A,
        memberIds: ["member-y", "member-z"],
        teamLeadId: "member-y",
      })
    ).toBe(false);
  });

  it("NÃO acessa projeto sem nenhuma relação (apenas mesma organização)", () => {
    expect(canSeeProject(memberA, { organizationId: ORG_A, memberIds: [] })).toBe(false);
  });
});

describe("MEMBER — tarefas", () => {
  it("acessa a tarefa da qual é responsável", () => {
    expect(
      canSeeTask(memberA, {
        organizationId: ORG_A,
        assigneeIds: ["member-a"],
      })
    ).toBe(true);
  });

  it("acessa tarefa em projeto do qual participa", () => {
    expect(
      canSeeTask(memberA, {
        organizationId: ORG_A,
        project: { organizationId: ORG_A, memberIds: ["member-a"] },
      })
    ).toBe(true);
  });

  it("NÃO acessa tarefa de outro usuário apenas por pertencer à organização", () => {
    expect(
      canSeeTask(memberA, {
        organizationId: ORG_A,
        assigneeIds: ["member-zzz"],
        projectId: OTHER_PROJECT,
        project: { organizationId: ORG_A, memberIds: ["member-zzz"] },
      })
    ).toBe(false);
  });

  it("acessa tarefa da equipe da qual participa", () => {
    expect(
      canSeeTask(memberA, { organizationId: ORG_A, teamId: "team-1", teamMemberIds: ["member-a"] })
    ).toBe(true);
  });

  it("NÃO acessa tarefa de equipe da qual não participa", () => {
    expect(
      canSeeTask(memberA, {
        organizationId: ORG_A,
        teamId: "team-9",
        teamMemberIds: ["member-z"],
      })
    ).toBe(false);
  });

  it("NÃO acessa tarefa avulsa (sem projeto/equipe) que não é sua", () => {
    expect(canSeeTask(memberA, { organizationId: ORG_A, assigneeIds: [] })).toBe(false);
  });

  it("LEADER acessa tarefa da equipe que lidera", () => {
    expect(
      canSeeTask(leaderA, { organizationId: ORG_A, teamId: "team-1", teamLeadId: "member-a1" })
    ).toBe(true);
  });
});

describe("Consistência entre taskVisibilityWhere e canSeeTask", () => {
  it("MEMBER: where inclui a equipe da qual participa", () => {
    const or = (taskVisibilityWhere(memberA).OR ?? []) as unknown[];
    expect(JSON.stringify(or)).toContain("team");
  });

  it("LEAD: where inclui liderança de equipe", () => {
    const or = (taskVisibilityWhere(leaderA).OR ?? []) as unknown[];
    expect(JSON.stringify(or)).toContain("leadId");
  });
});

describe("MEMBER — equipes", () => {
  it("acessa a equipe da qual participa", () => {
    expect(canSeeTeam(memberA, { organizationId: ORG_A, memberIds: ["member-a"] })).toBe(true);
  });

  it("NÃO acessa equipe de outro usuário", () => {
    expect(canSeeTeam(memberA, { organizationId: ORG_A, memberIds: ["member-x"] })).toBe(false);
  });

  it("NÃO acessa equipe apenas por ser líder (MEMBER não lidera escopo amplo)", () => {
    expect(
      canSeeTeam(memberA, { organizationId: ORG_A, leadId: "member-a", memberIds: [] })
    ).toBe(false);
  });
});

describe("MEMBER — departamentos", () => {
  it("acessa o próprio departamento", () => {
    expect(canSeeDepartment(memberA, { organizationId: ORG_A, memberIds: ["member-a"] })).toBe(true);
  });

  it("NÃO acessa departamento diferente", () => {
    expect(
      canSeeDepartment(memberA, { organizationId: ORG_A, memberIds: ["member-x"] })
    ).toBe(false);
  });
});

describe("MEMBER — eventos (modelo atual, sem EventParticipant)", () => {
  it("acessa evento pessoal", () => {
    expect(canSeeEvent(memberA, { organizationId: ORG_A, userId: "user-a" })).toBe(true);
  });

  it("acessa evento da equipe do usuário", () => {
    const scope = { ...memberA, teamIds: ["team-1"] };
    expect(canSeeEvent(scope, { organizationId: ORG_A, teamId: "team-1" })).toBe(true);
  });

  it("acessa evento de equipe da qual participa sem teamIds pré-carregado", () => {
    expect(
      canSeeEvent(memberA, {
        organizationId: ORG_A,
        teamId: "team-1",
        teamMemberIds: ["member-a"],
      })
    ).toBe(true);
  });

  it("acessa evento de tarefa cuja equipe o MEMBER participa", () => {
    expect(
      canSeeEvent(memberA, {
        organizationId: ORG_A,
        task: {
          organizationId: ORG_A,
          teamId: "team-1",
          teamMemberIds: ["member-a"],
        },
      })
    ).toBe(true);
  });

  it("acessa evento de projeto permitido", () => {
    expect(
      canSeeEvent(memberA, {
        organizationId: ORG_A,
        project: { organizationId: ORG_A, memberIds: ["member-a"] },
      })
    ).toBe(true);
  });

  it("acessa evento de tarefa permitida", () => {
    expect(
      canSeeEvent(memberA, {
        organizationId: ORG_A,
        task: { organizationId: ORG_A, assigneeIds: ["member-a"] },
      })
    ).toBe(true);
  });

  it("NÃO acessa evento de outro usuário", () => {
    expect(
      canSeeEvent(memberA, {
        organizationId: ORG_A,
        userId: "user-zzz",
        teamId: "team-9",
        project: { organizationId: ORG_A, memberIds: ["member-zzz"] },
      })
    ).toBe(false);
  });

  it("NÃO libera simplesmente todos os eventos da organização", () => {
    expect(
      canSeeEvent(memberA, {
        organizationId: ORG_A,
        userId: null,
        teamId: null,
        projectId: null,
        taskId: null,
      })
    ).toBe(false);
  });
});

describe("MEMBER — anúncios por audiência", () => {
  it("lê aviso da empresa", () => {
    expect(
      canSeeAnnouncement(memberA, { organizationId: ORG_A, audience: "company" })
    ).toBe(true);
  });

  it("lê aviso destinado a ele", () => {
    expect(
      canSeeAnnouncement(memberA, {
        organizationId: ORG_A,
        audience: "user",
        audienceId: "user-a",
      })
    ).toBe(true);
  });

  it("NÃO lê aviso destinado a outro colaborador", () => {
    expect(
      canSeeAnnouncement(memberA, {
        organizationId: ORG_A,
        audience: "user",
        audienceId: "user-zzz",
      })
    ).toBe(false);
  });

  it("lê aviso do próprio departamento", () => {
    expect(
      canSeeAnnouncement(memberA, {
        organizationId: ORG_A,
        audience: "department",
        audienceId: "dep-a",
      })
    ).toBe(true);
  });

  it("NÃO lê aviso de outra equipe", () => {
    expect(
      canSeeAnnouncement(
        { ...memberA, teamIds: ["team-1"] },
        { organizationId: ORG_A, audience: "team", audienceId: "team-9" }
      )
    ).toBe(false);
  });

  it("lê aviso da equipe que participa", () => {
    expect(
      canSeeAnnouncement(
        { ...memberA, teamIds: ["team-1"] },
        { organizationId: ORG_A, audience: "team", audienceId: "team-1" }
      )
    ).toBe(true);
  });

  it("audiência desconhecida falha fechado", () => {
    expect(
      canSeeAnnouncement(memberA, { organizationId: ORG_A, audience: "secreto" })
    ).toBe(false);
  });
});

describe("MEMBER — metas", () => {
  it("acessa meta da qual é responsável", () => {
    expect(canSeeGoal(memberA, { organizationId: ORG_A, responsibleId: "member-a" })).toBe(true);
  });

  it("acessa meta da qual é membro", () => {
    expect(canSeeGoal(memberA, { organizationId: ORG_A, memberIds: ["member-a"] })).toBe(true);
  });

  it("NÃO acessa meta de outro usuário", () => {
    expect(
      canSeeGoal(memberA, {
        organizationId: ORG_A,
        responsibleId: "member-zzz",
        memberIds: ["member-zzz"],
      })
    ).toBe(false);
  });
});

// ------------------------------------------------------------
// MULTI-TENANT
// ------------------------------------------------------------

describe("Multi-tenant — organização A não acessa recurso da B", () => {
  it("projeto da organização B", () => {
    expect(canSeeProject(memberA, { organizationId: ORG_B, memberIds: ["member-a"] })).toBe(false);
  });

  it("tarefa da organização B", () => {
    expect(
      canSeeTask(memberA, { organizationId: ORG_B, assigneeIds: ["member-a"] })
    ).toBe(false);
  });

  it("equipe da organização B", () => {
    expect(canSeeTeam(memberA, { organizationId: ORG_B, memberIds: ["member-a"] })).toBe(false);
  });

  it("departamento da organização B", () => {
    expect(canSeeDepartment(memberA, { organizationId: ORG_B, memberIds: ["member-a"] })).toBe(false);
  });

  it("evento da organização B", () => {
    expect(canSeeEvent(memberA, { organizationId: ORG_B, userId: "user-a" })).toBe(false);
  });

  it("meta da organização B", () => {
    expect(canSeeGoal(memberA, { organizationId: ORG_B, responsibleId: "member-a" })).toBe(false);
  });

  it("aviso da organização B", () => {
    expect(
      canSeeAnnouncement(memberA, { organizationId: ORG_B, audience: "company" })
    ).toBe(false);
  });

  it("usuários A e B não se enxergam via visibleMembersWhere", () => {
    expect(visibleMembersWhere(memberA)).toEqual({
      organizationId: ORG_A,
      id: "member-a",
    });
    expect(visibleMembersWhere(memberB)).toEqual({
      organizationId: ORG_B,
      id: "member-b",
    });
  });

  it("filtros de listagem sempre carregam o organizationId do escopo", () => {
    for (const where of [
      projectVisibilityWhere(memberA),
      taskVisibilityWhere(memberA),
      teamVisibilityWhere(memberA),
      departmentVisibilityWhere(memberA),
      eventVisibilityWhere(memberA),
      goalVisibilityWhere(memberA),
      announcementVisibilityWhere(memberA),
      activityVisibilityWhere(memberA),
    ]) {
      expect(where.organizationId).toBe(ORG_A);
      // escopo restrito NUNCA pode ser apenas organizationId
      expect(Object.keys(where).length).toBeGreaterThan(1);
    }
  });
});

// ------------------------------------------------------------
// ROLES
// ------------------------------------------------------------

describe("Papéis — escopo organizacional", () => {
  it.each<RoleName>(["OWNER", "ADMIN", "MANAGER"])(
    "%s enxerga qualquer projeto da própria organização",
    (role) => {
      expect(canSeeProject(asRole(role), { organizationId: ORG_A })).toBe(true);
    }
  );

  it.each<RoleName>(["OWNER", "ADMIN", "MANAGER"])(
    "%s enxerga qualquer tarefa da própria organização",
    (role) => {
      expect(canSeeTask(asRole(role), { organizationId: ORG_A })).toBe(true);
    }
  );

  it("mesmo escopo organizacional nunca vaza para outra organização", () => {
    expect(canSeeProject(asRole("OWNER"), { organizationId: ORG_B })).toBe(false);
  });
});

describe("LEADER — escopo de liderança", () => {
  it("acessa a equipe que lidera", () => {
    expect(canSeeTeam(leaderA, { organizationId: ORG_A, leadId: "member-a1" })).toBe(true);
  });

  it("NÃO acessa equipe que não lidera nem participa", () => {
    expect(
      canSeeTeam(leaderA, { organizationId: ORG_A, leadId: "member-z", memberIds: ["member-z"] })
    ).toBe(false);
  });

  it("acessa projetos da equipe que lidera", () => {
    expect(
      canSeeProject(leaderA, {
        organizationId: ORG_A,
        memberIds: [],
        teamLeadId: "member-a1",
      })
    ).toBe(true);
  });

  it("acessa metas da equipe que lidera", () => {
    expect(
      canSeeGoal(leaderA, { organizationId: ORG_A, teamId: "team-1", teamLeadId: "member-a1" })
    ).toBe(true);
  });

  it("acessa tarefas atribuídas a si", () => {
    expect(canSeeTask(leaderA, { organizationId: ORG_A, assigneeIds: ["member-a1"] })).toBe(true);
  });
});

// ------------------------------------------------------------
// INDICADORES — permission x scope
// ------------------------------------------------------------

describe("Indicadores — Permission separada de Scope", () => {
  it("PERMISSION: usa o RBAC existente (nenhuma regra nova)", () => {
    for (const role of ["OWNER", "ADMIN", "MANAGER", "LEADER", "MEMBER"] as RoleName[]) {
      expect(canAccessIndicatorsModule(permits, role)).toBe(permits(role, "indicators.read"));
    }
  });

  it("SCOPE: escopo organizacional preserva o memberId pedido", () => {
    const s = asRole("MANAGER");
    expect(indicatorScopeFor(s, { memberId: "member-x" }).memberId).toBe("member-x");
  });

  it("SCOPE: MEMBER tem memberId FORÇADO (não aceita o da URL)", () => {
    expect(indicatorScopeFor(memberA, { memberId: "member-zzz" }).memberId).toBe("member-a");
  });

  it("SCOPE: LEADER tem memberId FORÇADO", () => {
    expect(indicatorScopeFor(leaderA, { memberId: "member-zzz" }).memberId).toBe("member-a1");
  });

  it("SCOPE: escopo organizacional mantém o filtro organizacional", () => {
    expect(visibleMembersWhere(asRole("OWNER"))).toEqual({ organizationId: ORG_A });
  });
});

// ------------------------------------------------------------
// ATIVIDADES
// ------------------------------------------------------------

describe("Atividades — MEMBER não vê o ActivityLog inteiro", () => {
  it("o filtro exige relação com o usuário", () => {
    const where = activityVisibilityWhere(memberA);
    expect(where.organizationId).toBe(ORG_A);
    expect(Array.isArray(where.OR)).toBe(true);
    expect(where.OR).toContainEqual({ userId: "user-a" });
  });

  it("OWNER mantém visão organizacional", () => {
    expect(activityVisibilityWhere(asRole("OWNER"))).toEqual({ organizationId: ORG_A });
  });
});