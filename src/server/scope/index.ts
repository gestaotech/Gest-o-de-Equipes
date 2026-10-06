/**
 * Data Scope — camada de aplicação.
 *
 * Este módulo resolve o contexto do usuário a partir da SESSÃO e aplica as
 * regras puras de `rules.ts` sobre consultas reais.
 *
 * Conceito:
 *   requireSessionApi() -> session.sub -> OrganizationMember -> orgId + role -> Data Scope
 *
 * `organizationId` sempre vem do membership resolvido pela sessão ativa.
 * Nunca de parâmetro do cliente.
 */

import "server-only";
import { prisma } from "@/lib/prisma";
import { getContext } from "@/server/guards";
import { getSession, getActiveOrg } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import {
  dataScopeFrom,
  canSeeAnnouncement,
  canSeeDepartment,
  canSeeEvent,
  canSeeGoal,
  canSeeProject,
  canSeeTask,
  canSeeTeam,
  activityVisibilityWhere,
  announcementVisibilityWhere,
  departmentVisibilityWhere,
  eventVisibilityWhere,
  goalVisibilityWhere,
  projectVisibilityWhere,
  taskVisibilityWhere,
  teamVisibilityWhere,
  type DataScope,
  type AnnouncementScopeShape,
  type DepartmentScopeShape,
  type EventScopeShape,
  type GoalScopeShape,
  type ProjectScopeShape,
  type TaskScopeShape,
  type TeamScopeShape,
} from "./rules";
import type { RoleName } from "@/lib/rbac";
import type { SessionPayload } from "@/lib/auth";

export * from "./rules";

// ------------------------------------------------------------
// CONTEXTO
// ------------------------------------------------------------

export type ScopeContext = DataScope & {
  session: SessionPayload;
  membership: Awaited<ReturnType<typeof getContext>>["membership"];
};

/** Server Actions / Route Handlers: lança AppError quando não há sessão/org. */
export async function requireDataScope(): Promise<ScopeContext> {
  const { session, orgId, membership } = await getContext();
  return {
    ...dataScopeFrom({
      orgId,
      userId: session.sub,
      memberId: membership.id,
      role: membership.role as RoleName,
      departmentId: membership.departmentId,
    }),
    session,
    membership,
  };
}

/** Páginas: mesmo fluxo, porém redireciona em vez de lançar. */
export async function getPageDataScope(redirect: (url: string) => never): Promise<ScopeContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  const org = await getActiveOrg(session);
  if (!org) redirect("/criar-org");
  if (org.membership.status !== "ATIVO") redirect("/dashboard");
  return {
    ...dataScopeFrom({
      orgId: org.id,
      userId: session.sub,
      memberId: org.membership.id,
      role: org.role as RoleName,
      departmentId: org.membership.departmentId,
    }),
    session,
    membership: org.membership,
  };
}

/**
 * Carrega as relações de equipe, necessárias para eventos/avisos/equipes.
 * Feito sob demanda para não penalizar quem não precisa.
 */
export async function withTeamRelations(scope: DataScope): Promise<DataScope> {
  if (scope.level === "ORG") return scope;
  const rows = await prisma.teamMember.findMany({
    where: { memberId: scope.memberId, team: { organizationId: scope.orgId } },
    select: { teamId: true },
  });
  const led = await prisma.team.findMany({
    where: { leadId: scope.memberId, organizationId: scope.orgId },
    select: { id: true },
  });
  return {
    ...scope,
    teamIds: Array.from(new Set([...rows.map((r) => r.teamId), ...led.map((t) => t.id)])),
    ledTeamIds: led.map((t) => t.id),
  };
}

// ------------------------------------------------------------
// canAccess*  (recurso único — nunca apenas organizationId)
// ------------------------------------------------------------

export async function canAccessProject(scope: DataScope, projectId: string): Promise<boolean> {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      organizationId: true,
      teamId: true,
      responsibleId: true,
      team: { select: { leadId: true } },
      members: { select: { memberId: true } },
    },
  });
  if (!p) return false;
  const shape: ProjectScopeShape = {
    organizationId: p.organizationId,
    teamId: p.teamId,
    responsibleId: p.responsibleId,
    teamLeadId: p.team?.leadId ?? null,
    memberIds: p.members.map((m) => m.memberId),
  };
  return canSeeProject(scope, shape);
}

export async function canAccessTask(scope: DataScope, taskId: string): Promise<boolean> {
  const t = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      organizationId: true,
      projectId: true,
      teamId: true,
      createdById: true,
      assignees: { select: { memberId: true } },
      team: { select: { leadId: true, members: { select: { memberId: true } } } },
      project: {
        select: {
          organizationId: true,
          teamId: true,
          responsibleId: true,
          team: { select: { leadId: true } },
          members: { select: { memberId: true } },
        },
      },
    },
  });
  if (!t) return false;
  const shape: TaskScopeShape = {
    organizationId: t.organizationId,
    projectId: t.projectId,
    teamId: t.teamId,
    createdById: t.createdById,
    assigneeIds: t.assignees.map((a) => a.memberId),
    teamLeadId: t.team?.leadId ?? null,
    teamMemberIds: t.team?.members.map((m) => m.memberId),
    project: t.project
      ? {
          organizationId: t.project.organizationId,
          teamId: t.project.teamId,
          responsibleId: t.project.responsibleId,
          teamLeadId: t.project.team?.leadId ?? null,
          memberIds: t.project.members.map((m) => m.memberId),
        }
      : null,
  };
  return canSeeTask(scope, shape);
}

export async function canAccessTeam(scope: DataScope, teamId: string): Promise<boolean> {
  const t = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      organizationId: true,
      leadId: true,
      members: { select: { memberId: true } },
    },
  });
  if (!t) return false;
  const shape: TeamScopeShape = {
    organizationId: t.organizationId,
    leadId: t.leadId,
    memberIds: t.members.map((m) => m.memberId),
  };
  return canSeeTeam(scope, shape);
}

export async function canAccessDepartment(scope: DataScope, departmentId: string): Promise<boolean> {
  const d = await prisma.department.findUnique({
    where: { id: departmentId },
    select: {
      organizationId: true,
      members: { select: { id: true } },
      teams: { select: { leadId: true } },
    },
  });
  if (!d) return false;
  const shape: DepartmentScopeShape = {
    organizationId: d.organizationId,
    memberIds: d.members.map((m) => m.id),
    teamLeadIds: d.teams.map((t) => t.leadId).filter((v): v is string => !!v),
  };
  return canSeeDepartment(scope, shape);
}

export async function canAccessEvent(scope: DataScope, eventId: string): Promise<boolean> {
  const resolved = await withTeamRelations(scope);
  const e = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      organizationId: true,
      userId: true,
      teamId: true,
      projectId: true,
      taskId: true,
      team: { select: { leadId: true, members: { select: { memberId: true } } } },
      project: {
        select: {
          organizationId: true,
          teamId: true,
          responsibleId: true,
          team: { select: { leadId: true } },
          members: { select: { memberId: true } },
        },
      },
      task: {
        select: {
          organizationId: true,
          projectId: true,
          teamId: true,
          createdById: true,
          assignees: { select: { memberId: true } },
          team: { select: { leadId: true, members: { select: { memberId: true } } } },
          project: {
            select: {
              organizationId: true,
              teamId: true,
              responsibleId: true,
              team: { select: { leadId: true } },
              members: { select: { memberId: true } },
            },
          },
        },
      },
    },
  });
  if (!e) return false;
  const toProject = (p: NonNullable<typeof e.project>): ProjectScopeShape => ({
    organizationId: p.organizationId,
    teamId: p.teamId,
    responsibleId: p.responsibleId,
    teamLeadId: p.team?.leadId ?? null,
    memberIds: p.members.map((m) => m.memberId),
  });
  const shape: EventScopeShape = {
    organizationId: e.organizationId,
    userId: e.userId,
    teamId: e.teamId,
    projectId: e.projectId,
    taskId: e.taskId,
    teamLeadId: e.team?.leadId ?? null,
    teamMemberIds: e.team?.members.map((m) => m.memberId),
    project: e.project ? toProject(e.project) : null,
    task: e.task
      ? {
          organizationId: e.task.organizationId,
          projectId: e.task.projectId,
          teamId: e.task.teamId,
          createdById: e.task.createdById,
          assigneeIds: e.task.assignees.map((a) => a.memberId),
          teamLeadId: e.task.team?.leadId ?? null,
          teamMemberIds: e.task.team?.members.map((m) => m.memberId),
          project: e.task.project ? toProject(e.task.project) : null,
        }
      : null,
  };
  return canSeeEvent(resolved, shape);
}

export async function canAccessAnnouncement(scope: DataScope, announcementId: string): Promise<boolean> {
  const resolved = await withTeamRelations(scope);
  const a = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: { organizationId: true, audience: true, audienceId: true },
  });
  if (!a) return false;
  const shape: AnnouncementScopeShape = {
    organizationId: a.organizationId,
    audience: a.audience,
    audienceId: a.audienceId,
  };
  return canSeeAnnouncement(resolved, shape);
}

export async function canAccessGoal(scope: DataScope, goalId: string): Promise<boolean> {
  const resolved = await withTeamRelations(scope);
  const g = await prisma.goal.findUnique({
    where: { id: goalId },
    select: {
      organizationId: true,
      responsibleId: true,
      teamId: true,
      members: { select: { memberId: true } },
      team: { select: { leadId: true } },
    },
  });
  if (!g) return false;
  const shape: GoalScopeShape = {
    organizationId: g.organizationId,
    responsibleId: g.responsibleId,
    teamId: g.teamId,
    memberIds: g.members.map((m) => m.memberId),
    teamLeadId: g.team?.leadId ?? null,
  };
  return canSeeGoal(resolved, shape);
}

/** Erro padronizado para uso em Route Handlers / actions. */
export function assertCanAccessProject(scope: DataScope, projectId: string): Promise<void> {
  return canAccessProject(scope, projectId).then((ok) => {
    if (!ok) throw new AppError("NOT_FOUND", "Projeto não encontrado.", 404);
  });
}

// ------------------------------------------------------------
// getVisible*  (listagens já filtradas pelo escopo)
// ------------------------------------------------------------

export function getVisibleProjects(scope: DataScope, args?: { take?: number }) {
  return prisma.project.findMany({
    where: projectVisibilityWhere(scope),
    orderBy: { createdAt: "desc" },
    ...(args?.take ? { take: args.take } : {}),
  });
}

export function getVisibleTasks(scope: DataScope, args?: { take?: number }) {
  return prisma.task.findMany({
    where: taskVisibilityWhere(scope),
    orderBy: { createdAt: "desc" },
    ...(args?.take ? { take: args.take } : {}),
  });
}

export function getVisibleTeams(scope: DataScope, args?: { take?: number }) {
  return prisma.team.findMany({
    where: { ...teamVisibilityWhere(scope), archivedAt: null },
    orderBy: { name: "asc" },
    ...(args?.take ? { take: args.take } : {}),
  });
}

export function getVisibleDepartments(scope: DataScope) {
  return prisma.department.findMany({
    where: departmentVisibilityWhere(scope),
    orderBy: { name: "asc" },
  });
}

export function getVisibleEvents(scope: DataScope, args?: { take?: number }) {
  return prisma.event.findMany({
    where: eventVisibilityWhere(scope),
    orderBy: { startsAt: "asc" },
    ...(args?.take ? { take: args.take } : {}),
  });
}

export async function getVisibleAnnouncements(scope: DataScope) {
  const resolved = await withTeamRelations(scope);
  return prisma.announcement.findMany({
    where: announcementVisibilityWhere(resolved),
    orderBy: { createdAt: "desc" },
  });
}

export function getVisibleGoals(scope: DataScope, args?: { take?: number }) {
  return prisma.goal.findMany({
    where: goalVisibilityWhere(scope),
    orderBy: { createdAt: "desc" },
    ...(args?.take ? { take: args.take } : {}),
  });
}

export function getVisibleActivity(scope: DataScope, args?: { take?: number }) {
  return prisma.activityLog.findMany({
    where: activityVisibilityWhere(scope),
    orderBy: { createdAt: "desc" },
    ...(args?.take ? { take: args.take } : {}),
  });
}