import "server-only";
import { prisma } from "@/lib/prisma";
import { ProjectStatus, TaskStatus } from "@prisma/client";
import {
  getOrgSummary,
  getProjectBoard,
  type IndicatorScope,
  type ProjectRow,
} from "@/lib/indicator-queries";
import {
  activityVisibilityWhere,
  eventVisibilityWhere,
  taskVisibilityWhere,
  visibleMembersWhere,
  type DataScope,
} from "@/server/scope/rules";

// ------------------------------------------------------------
// DADOS DO DASHBOARD — todas as consultas respeitam o Data Scope.
//
// Antes estas funções recebiam apenas `orgId`, o que entregava a organização
// inteira ao MEMBER. Agora recebem o Data Scope resolvido pela sessão
// (session.sub -> OrganizationMember -> orgId + role) e aplicam o filtro
// de visibilidade do perfil.
//
// `organizationId` continua vindo da sessão, nunca do frontend.
// ------------------------------------------------------------

/** Escopo de indicadores derivado do Data Scope (mantém orgId da sessão). */
function indicatorScopeOf(
  scope: DataScope,
  period: IndicatorScope["period"] = "30d"
): IndicatorScope {
  return { orgId: scope.orgId, period, restrict: scope };
}

export type DashboardKpis = {
  members: number;
  newMembersThisMonth: number;
  tasksPending: number;
  tasksOverdue: number;
  tasksRate: number | null;
  tasksDone: number;
  tasksTotal: number;
  projectsActive: number;
  projectsOverdue: number;
  goalsInProgress: number;
  goalsAtRisk: number;
};

export async function getDashboardKpis(scope: DataScope): Promise<DashboardKpis> {
  const startOfMonth = new Date();
  startOfMonth.setHours(0, 0, 0, 0);
  startOfMonth.setDate(1);

  // Contagens de pessoas respeitam o escopo: MEMBER não conta a organização.
  const memberWhere = visibleMembersWhere(scope);

  const [members, newMembersThisMonth, summary] = await Promise.all([
    prisma.organizationMember.count({
      where: { ...memberWhere, status: "ATIVO" },
    }),
    prisma.organizationMember.count({
      where: { ...memberWhere, joinedAt: { gte: startOfMonth } },
    }),
    getOrgSummary(indicatorScopeOf(scope), null),
  ]);

  return {
    members,
    newMembersThisMonth,
    tasksPending: summary.tasks.pending,
    tasksOverdue: summary.tasks.overdue,
    tasksRate: summary.tasks.rate,
    tasksDone: summary.tasks.done,
    tasksTotal: summary.tasks.total,
    projectsActive: summary.projects.active,
    projectsOverdue: summary.projects.overdue,
    goalsInProgress: summary.goals.inProgress,
    goalsAtRisk: summary.goals.atRisk,
  };
}

export type DashboardTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  projectName: string | null;
  assigneeName: string | null;
  dueDate: Date | null;
  overdue: boolean;
};

const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export async function getPriorityTasks(scope: DataScope, take = 6): Promise<DashboardTask[]> {
  const now = Date.now();
  const pending = await prisma.task.findMany({
    where: {
      ...taskVisibilityWhere(scope),
      status: { not: TaskStatus.DONE },
    },
    include: {
      project: { select: { name: true } },
      assignees: {
        include: { member: { include: { user: { select: { name: true } } } } },
        take: 1,
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 30,
  });

  const sorted = pending
    .map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      projectName: t.project?.name ?? null,
      assigneeName: t.assignees[0]?.member.user.name ?? null,
      dueDate: t.dueDate,
      overdue: Boolean(t.dueDate) && t.dueDate!.getTime() < now,
    }))
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const pa = PRIORITY_RANK[a.priority] ?? 9;
      const pb = PRIORITY_RANK[b.priority] ?? 9;
      if (pa !== pb) return pa - pb;
      const da = a.dueDate ? a.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
      const db = b.dueDate ? b.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
      return da - db;
    });

  return sorted.slice(0, take);
}

export async function getActiveProjects(scope: DataScope, take = 5): Promise<ProjectRow[]> {
  const board = await getProjectBoard(indicatorScopeOf(scope), null);
  return board
    .filter((p) => p.status === ProjectStatus.EM_ANDAMENTO)
    .sort((a, b) => {
      const da = a.dueDate ? a.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
      const db = b.dueDate ? b.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
      return da - db;
    })
    .slice(0, take);
}

export type DashboardEvent = {
  id: string;
  title: string;
  startsAt: Date;
  projectName: string | null;
};

export async function getUpcomingEvents(scope: DataScope, take = 6): Promise<DashboardEvent[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 86400000);
  const events = await prisma.event.findMany({
    where: { ...eventVisibilityWhere(scope), startsAt: { gte: now, lte: horizon } },
    include: { project: { select: { name: true } } },
    orderBy: { startsAt: "asc" },
    take,
  });
  return events.map((e) => ({
    id: e.id,
    title: e.title,
    startsAt: e.startsAt,
    projectName: e.project?.name ?? null,
  }));
}

export type DashboardActivity = {
  id: string;
  action: string;
  userName: string | null;
  createdAt: Date;
};

export async function getRecentActivity(scope: DataScope, take = 6): Promise<DashboardActivity[]> {
  const logs = await prisma.activityLog.findMany({
    where: activityVisibilityWhere(scope),
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return logs.map((l) => ({
    id: l.id,
    action: l.action,
    userName: l.user?.name ?? null,
    createdAt: l.createdAt,
  }));
}