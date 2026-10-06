/**
 * Data Scope — camada de aplicação (fala com o banco).
 *
 * Verifica que os canAccess* carregam o recurso e aplicam o predicado,
 * bloqueando inclusive acesso cross-tenant por ID manipulado.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findUnique: vi.fn() },
    task: { findUnique: vi.fn() },
    team: { findUnique: vi.fn(), findMany: vi.fn() },
    department: { findUnique: vi.fn() },
    event: { findUnique: vi.fn() },
    announcement: { findUnique: vi.fn() },
    goal: { findUnique: vi.fn() },
    teamMember: { findMany: vi.fn() },
    activityLog: { findMany: vi.fn() },
  },
}));

vi.mock("@/server/guards", () => ({
  getContext: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireSessionApi: vi.fn(),
  getSession: vi.fn(),
  getActiveOrg: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getContext } from "@/server/guards";
import {
  canAccessAnnouncement,
  canAccessDepartment,
  canAccessEvent,
  canAccessGoal,
  canAccessProject,
  canAccessTask,
  canAccessTeam,
  requireDataScope,
  withTeamRelations,
} from "@/server/scope";

const mocked = prisma as unknown as Record<string, { [k: string]: ReturnType<typeof vi.fn> }>;

const ORG_A = "org-a";
const ORG_B = "org-b";

const ctx = {
  session: { sub: "user-a", email: "a@x.com", name: "A" },
  orgId: ORG_A,
  membership: {
    id: "member-a",
    organizationId: ORG_A,
    userId: "user-a",
    role: "MEMBER" as const,
    status: "ATIVO" as const,
    departmentId: "dep-a",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (getContext as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ctx);
  mocked.teamMember.findMany.mockResolvedValue([]);
  mocked.team.findMany.mockResolvedValue([]);
});

describe("requireDataScope", () => {
  it("deriva org/member/role do contexto de sessão", async () => {
    const s = await requireDataScope();
    expect(s.orgId).toBe(ORG_A);
    expect(s.userId).toBe("user-a");
    expect(s.memberId).toBe("member-a");
    expect(s.role).toBe("MEMBER");
    expect(s.level).toBe("SELF");
    expect(s.departmentId).toBe("dep-a");
  });

  it("nunca aceita organizationId do cliente (vem de getContext)", async () => {
    await requireDataScope();
    expect(getContext).toHaveBeenCalledTimes(1);
  });
});

describe("canAccessProject", () => {
  it("permite projeto do qual o MEMBER participa", async () => {
    mocked.project.findUnique.mockResolvedValue({
      organizationId: ORG_A,
      teamId: null,
      responsibleId: null,
      team: null,
      members: [{ memberId: "member-a" }],
    });
    const s = await requireDataScope();
    await expect(canAccessProject(s, "proj-1")).resolves.toBe(true);
  });

  it("NEGA projeto sem relação do MEMBER", async () => {
    mocked.project.findUnique.mockResolvedValue({
      organizationId: ORG_A,
      teamId: null,
      responsibleId: null,
      team: null,
      members: [{ memberId: "member-z" }],
    });
    const s = await requireDataScope();
    await expect(canAccessProject(s, "proj-1")).resolves.toBe(false);
  });

  it("NEGA projeto de outra organização (multi-tenant)", async () => {
    mocked.project.findUnique.mockResolvedValue({
      organizationId: ORG_B,
      teamId: null,
      responsibleId: "member-a",
      team: null,
      members: [{ memberId: "member-a" }],
    });
    const s = await requireDataScope();
    await expect(canAccessProject(s, "proj-b")).resolves.toBe(false);
  });

  it("NEGA projeto inexistente", async () => {
    mocked.project.findUnique.mockResolvedValue(null);
    const s = await requireDataScope();
    await expect(canAccessProject(s, "nao-existe")).resolves.toBe(false);
  });
});

describe("canAccessTask", () => {
  it("permite tarefa atribuída ao MEMBER", async () => {
    mocked.task.findUnique.mockResolvedValue({
      organizationId: ORG_A,
      projectId: null,
      teamId: null,
      createdById: null,
      assignees: [{ memberId: "member-a" }],
      team: null,
      project: null,
    });
    const s = await requireDataScope();
    await expect(canAccessTask(s, "task-1")).resolves.toBe(true);
  });

  it("acessa tarefa da equipe da qual o MEMBER participa", async () => {
    mocked.task.findUnique.mockResolvedValue({
      organizationId: ORG_A,
      projectId: null,
      teamId: "team-1",
      createdById: null,
      assignees: [],
      team: { leadId: null, members: [{ memberId: "member-a" }] },
      project: null,
    });
    const s = await requireDataScope();
    await expect(canAccessTask(s, "task-team")).resolves.toBe(true);
  });

  it("NEGA tarefa de equipe que o MEMBER não participa", async () => {
    mocked.task.findUnique.mockResolvedValue({
      organizationId: ORG_A,
      projectId: null,
      teamId: "team-9",
      createdById: null,
      assignees: [],
      team: { leadId: null, members: [{ memberId: "member-z" }] },
      project: null,
    });
    const s = await requireDataScope();
    await expect(canAccessTask(s, "task-other-team")).resolves.toBe(false);
  });

  it("NEGA tarefa de outro usuário na mesma organização", async () => {
    mocked.task.findUnique.mockResolvedValue({
      organizationId: ORG_A,
      projectId: "proj-z",
      teamId: null,
      createdById: null,
      assignees: [{ memberId: "member-z" }],
      team: null,
      project: {
        organizationId: ORG_A,
        teamId: null,
        responsibleId: "member-z",
        team: null,
        members: [{ memberId: "member-z" }],
      },
    });
    const s = await requireDataScope();
    await expect(canAccessTask(s, "task-2")).resolves.toBe(false);
  });

  it("NEGA tarefa de outra organização (multi-tenant)", async () => {
    mocked.task.findUnique.mockResolvedValue({
      organizationId: ORG_B,
      projectId: null,
      teamId: null,
      createdById: "user-a",
      assignees: [],
      team: null,
      project: null,
    });
    const s = await requireDataScope();
    await expect(canAccessTask(s, "task-b")).resolves.toBe(false);
  });
});

describe("canAccessTeam / canAccessDepartment", () => {
  it("permite equipe do MEMBER", async () => {
    mocked.team.findUnique.mockResolvedValue({
      organizationId: ORG_A,
      leadId: null,
      members: [{ memberId: "member-a" }],
    });
    const s = await requireDataScope();
    await expect(canAccessTeam(s, "team-1")).resolves.toBe(true);
  });

  it("NEGA equipe de outro usuário", async () => {
    mocked.team.findUnique.mockResolvedValue({
      organizationId: ORG_A,
      leadId: null,
      members: [{ memberId: "member-z" }],
    });
    const s = await requireDataScope();
    await expect(canAccessTeam(s, "team-9")).resolves.toBe(false);
  });

  it("permite o departamento próprio do MEMBER", async () => {
    mocked.department.findUnique.mockResolvedValue({
      organizationId: ORG_A,
      members: [{ id: "member-a" }],
      teams: [],
    });
    const s = await requireDataScope();
    await expect(canAccessDepartment(s, "dep-a")).resolves.toBe(true);
  });

  it("NEGA departamento diferente", async () => {
    mocked.department.findUnique.mockResolvedValue({
      organizationId: ORG_A,
      members: [{ id: "member-z" }],
      teams: [],
    });
    const s = await requireDataScope();
    await expect(canAccessDepartment(s, "dep-z")).resolves.toBe(false);
  });
});

describe("canAccessEvent", () => {
  it("permite evento pessoal", async () => {
    mocked.event.findUnique.mockResolvedValue({
      organizationId: ORG_A,
      userId: "user-a",
      teamId: null,
      projectId: null,
      taskId: null,
      team: null,
      project: null,
      task: null,
    });
    const s = await requireDataScope();
    await expect(canAccessEvent(s, "evt-1")).resolves.toBe(true);
  });

  it("acessa evento de equipe da qual o MEMBER participa", async () => {
    mocked.event.findUnique.mockResolvedValue({
      organizationId: ORG_A,
      userId: "user-z",
      teamId: "team-1",
      projectId: null,
      taskId: null,
      team: { leadId: null, members: [{ memberId: "member-a" }] },
      project: null,
      task: null,
    });
    const s = await requireDataScope();
    await expect(canAccessEvent(s, "evt-team")).resolves.toBe(true);
  });

  it("NEGA evento de outro usuário", async () => {
    mocked.event.findUnique.mockResolvedValue({
      organizationId: ORG_A,
      userId: "user-z",
      teamId: null,
      projectId: null,
      taskId: null,
      team: null,
      project: null,
      task: null,
    });
    const s = await requireDataScope();
    await expect(canAccessEvent(s, "evt-2")).resolves.toBe(false);
  });

  it("NEGA evento de outra organização (multi-tenant)", async () => {
    mocked.event.findUnique.mockResolvedValue({
      organizationId: ORG_B,
      userId: "user-a",
      teamId: null,
      projectId: null,
      taskId: null,
      team: null,
      project: null,
      task: null,
    });
    const s = await requireDataScope();
    await expect(canAccessEvent(s, "evt-b")).resolves.toBe(false);
  });
});

describe("canAccessAnnouncement", () => {
  it("permite aviso destinado ao próprio usuário", async () => {
    mocked.announcement.findUnique.mockResolvedValue({
      organizationId: ORG_A,
      audience: "user",
      audienceId: "user-a",
    });
    const s = await requireDataScope();
    await expect(canAccessAnnouncement(s, "ann-1")).resolves.toBe(true);
  });

  it("NEGA aviso privado de outro colaborador", async () => {
    mocked.announcement.findUnique.mockResolvedValue({
      organizationId: ORG_A,
      audience: "user",
      audienceId: "user-z",
    });
    const s = await requireDataScope();
    await expect(canAccessAnnouncement(s, "ann-2")).resolves.toBe(false);
  });

  it("NEGA aviso de outra equipe", async () => {
    mocked.announcement.findUnique.mockResolvedValue({
      organizationId: ORG_A,
      audience: "team",
      audienceId: "team-9",
    });
    mocked.teamMember.findMany.mockResolvedValue([{ teamId: "team-1" }]);
    mocked.team.findMany.mockResolvedValue([]);
    const s = await requireDataScope();
    await expect(canAccessAnnouncement(s, "ann-3")).resolves.toBe(false);
  });
});

describe("canAccessGoal", () => {
  it("permite meta da qual o MEMBER é responsável", async () => {
    mocked.goal.findUnique.mockResolvedValue({
      organizationId: ORG_A,
      responsibleId: "member-a",
      teamId: null,
      members: [],
      team: null,
    });
    const s = await requireDataScope();
    await expect(canAccessGoal(s, "goal-1")).resolves.toBe(true);
  });

  it("NEGA meta de outro usuário", async () => {
    mocked.goal.findUnique.mockResolvedValue({
      organizationId: ORG_A,
      responsibleId: "member-z",
      teamId: null,
      members: [{ memberId: "member-z" }],
      team: null,
    });
    const s = await requireDataScope();
    await expect(canAccessGoal(s, "goal-2")).resolves.toBe(false);
  });

  it("NEGA meta de outra organização (multi-tenant)", async () => {
    mocked.goal.findUnique.mockResolvedValue({
      organizationId: ORG_B,
      responsibleId: "member-a",
      teamId: null,
      members: [],
      team: null,
    });
    const s = await requireDataScope();
    await expect(canAccessGoal(s, "goal-b")).resolves.toBe(false);
  });
});

describe("withTeamRelations", () => {
  it("carrega as equipes do membro dentro da organização ativa", async () => {
    mocked.teamMember.findMany.mockResolvedValue([{ teamId: "team-1" }]);
    mocked.team.findMany.mockResolvedValue([{ id: "team-2" }]);
    const s = await requireDataScope();
    const loaded = await withTeamRelations(s);
    expect(loaded.teamIds).toEqual(["team-1", "team-2"]);
    expect(loaded.ledTeamIds).toEqual(["team-2"]);
    expect(mocked.teamMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ memberId: "member-a" }),
      })
    );
  });

  it("não consulta equipes para escopo organizacional", async () => {
    const orgScope = await requireDataScope();
    const s = { ...orgScope, role: "OWNER" as const, level: "ORG" as const };
    await withTeamRelations(s);
    expect(mocked.teamMember.findMany).not.toHaveBeenCalled();
    expect(mocked.team.findMany).not.toHaveBeenCalled();
  });
});

describe("ScopeContext — membership disponível para guardPerm", () => {
  it("requireDataScope devolve a membership do getContext", async () => {
    const s = await requireDataScope();
    expect(s.membership).toEqual(ctx.membership);
    expect(s.membership.role).toBe("MEMBER");
    expect(s.role).toBe(s.membership.role as never);
  });

  it("session e membership são consistentes entre si", async () => {
    const s = await requireDataScope();
    expect(s.session.sub).toBe(s.userId);
    expect(s.membership.userId).toBe(s.userId);
    expect(s.membership.id).toBe(s.memberId);
  });
});