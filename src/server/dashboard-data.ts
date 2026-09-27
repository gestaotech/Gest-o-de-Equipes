import "server-only";
import { prisma } from "@/lib/prisma";
import { ProjectStatus, TaskStatus } from "@prisma/client";
import { getOrgSummary, getProjectBoard, type ProjectRow } from "@/lib/indicator-queries";

// ------------------------------------------------------------
// DADOS DO DASHBOARD — consultas isoladas por bloco.
// orgId é derivado da sessão no servidor (nunca do frontend).
// ------------------------------------------------------------

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

export function getDashboardKpis(orgId: string): Promise<DashboardKpis> {
  const startOfMonth = new Date();
  startOfMonth.setHours(0, 0, 0, 0);
  startOfMonth.setDate(1);

  return Promise.all([
    prisma.organizationMember.count({
      where: { organizationId: orgId, status: "ATIVO" },
    }),
    prisma.organizationMember.count({
      where: { organizationId: orgId, joinedAt: { gte: startOfMonth } },
    }),
    getOrgSummary({ orgId, period: "30d" }, null),
  ]).then(([members, newMembersThisMonth, summary]) => ({
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
  }));
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

export async function getPriorityTasks(
  orgId: string,
  memberId: string | null,
  take = 6
): Promise<DashboardTask[]> {
  const now = Date.now();
  const pending = await prisma.task.findMany({
    where: {
      organizationId: orgId,
      status: { not: TaskStatus.DONE },
      ...(memberId ? { assignees: { some: { memberId } } } : {}),
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

export async function getActiveProjects(orgId: string, take = 5): Promise<ProjectRow[]> {
  const board = await getProjectBoard({ orgId, period: "30d" }, null);
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

export async function getUpcomingEvents(orgId: string, take = 6): Promise<DashboardEvent[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 86400000);
  const events = await prisma.event.findMany({
    where: { organizationId: orgId, startsAt: { gte: now, lte: horizon } },
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

export async function getRecentActivity(orgId: string, take = 6): Promise<DashboardActivity[]> {
  const logs = await prisma.activityLog.findMany({
    where: { organizationId: orgId },
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