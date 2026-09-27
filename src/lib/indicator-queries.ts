import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma, type TaskPriority, type TaskStatus } from "@prisma/client";
import {
  completionRate,
  type DateRange,
  isGoalAtRisk,
  isProjectOverdue,
  progressPercent,
  type ReportPeriod,
} from "@/lib/indicator-metrics";

// ------------------------------------------------------------
// INDICADORES — consultas/agregações no banco (COUNT · GROUP BY).
// scope.orgId é derivado da sessão no servidor, nunca do frontend.
// ------------------------------------------------------------

export type IndicatorScope = {
  orgId: string;
  period: ReportPeriod;
  from?: string;
  to?: string;
  teamId?: string;
  departmentId?: string;
  memberId?: string;
  projectId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
};

export type TaskWhere = Prisma.TaskWhereInput;

export function buildTaskWhere(scope: IndicatorScope, range: DateRange | null): TaskWhere {
  return {
    organizationId: scope.orgId,
    ...(range?.from
      ? { createdAt: { gte: range.from, ...(range.to ? { lt: range.to } : {}) } }
      : {}),
    ...(scope.teamId ? { teamId: scope.teamId } : {}),
    ...(scope.departmentId ? { team: { departmentId: scope.departmentId } } : {}),
    ...(scope.memberId ? { assignees: { some: { memberId: scope.memberId } } } : {}),
    ...(scope.projectId ? { projectId: scope.projectId } : {}),
    ...(scope.status ? { status: scope.status } : {}),
    ...(scope.priority ? { priority: scope.priority } : {}),
  };
}

export function buildProjectWhere(scope: IndicatorScope, range: DateRange | null): Prisma.ProjectWhereInput {
  return {
    organizationId: scope.orgId,
    ...(range?.from
      ? { createdAt: { gte: range.from, ...(range.to ? { lt: range.to } : {}) } }
      : {}),
    ...(scope.teamId ? { teamId: scope.teamId } : {}),
    ...(scope.departmentId ? { team: { departmentId: scope.departmentId } } : {}),
    ...(scope.memberId
      ? { OR: [{ responsibleId: scope.memberId }, { members: { some: { memberId: scope.memberId } } }] }
      : {}),
  };
}

export type TaskMetric = {
  total: number;
  done: number;
  pending: number;
  overdue: number;
  rate: number | null;
};

export async function getTaskMetrics(scope: IndicatorScope, range: DateRange | null): Promise<TaskMetric> {
  const where = buildTaskWhere(scope, range);
  const whereDone = { ...where, status: "DONE" } as TaskWhere;
  const whereOverdue = {
    AND: [{ status: { not: "DONE" } }, { dueDate: { lt: new Date() } }],
    ...where,
  } as TaskWhere;
  const [total, done, overdue] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.count({ where: whereDone }),
    prisma.task.count({ where: whereOverdue }),
  ]);
  return {
    total,
    done,
    pending: Math.max(0, total - done),
    overdue,
    rate: completionRate(done, total),
  };
}

export type DistributionRow = { key: string; count: number; percent: number | null };

export async function getStatusDistribution(scope: IndicatorScope, range: DateRange | null): Promise<DistributionRow[]> {
  const rows = await prisma.task.groupBy({
    by: ["status"],
    where: buildTaskWhere(scope, range),
    _count: { _all: true },
  });
  const byKey = new Map(rows.map((r) => [r.status, r._count._all]));
  const total = rows.reduce((acc, r) => acc + r._count._all, 0);
  return (
    ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as TaskStatus[]
  ).map((s) => ({
    key: s,
    count: byKey.get(s) ?? 0,
    percent: completionRate(byKey.get(s) ?? 0, total),
  }));
}

export async function getPriorityDistribution(scope: IndicatorScope, range: DateRange | null): Promise<DistributionRow[]> {
  const rows = await prisma.task.groupBy({
    by: ["priority"],
    where: buildTaskWhere(scope, range),
    _count: { _all: true },
  });
  const byKey = new Map(rows.map((r) => [r.priority, r._count._all]));
  const total = rows.reduce((acc, r) => acc + r._count._all, 0);
  return (
    ["LOW", "MEDIUM", "HIGH", "URGENT"] as TaskPriority[]
  ).map((p) => ({
    key: p,
    count: byKey.get(p) ?? 0,
    percent: completionRate(byKey.get(p) ?? 0, total),
  }));
}

// ------------------------------------------------------------
// EVOLUÇÃO DAS TAREFAS CONCLUÍDAS (escala dia · semana · mês)
// ------------------------------------------------------------

export type EvolutionGranularity = "day" | "week" | "month";

function taskSqlConditions(
  scope: IndicatorScope,
  range: DateRange | null,
  alias: string
): Prisma.Sql[] {
  const t = Prisma.raw(alias);
  const c: Prisma.Sql[] = [Prisma.sql`${t}."organizationId" = ${scope.orgId}`];
  if (range?.from) {
    c.push(
      range.to
        ? Prisma.sql`${t}."createdAt" >= ${range.from} AND ${t}."createdAt" < ${range.to}`
        : Prisma.sql`${t}."createdAt" >= ${range.from}`
    );
  }
  if (scope.projectId) c.push(Prisma.sql`${t}."projectId" = ${scope.projectId}`);
  if (scope.teamId) c.push(Prisma.sql`${t}."teamId" = ${scope.teamId}`);
  if (scope.status) c.push(Prisma.sql`${t}."status" = ${scope.status}`);
  if (scope.priority) c.push(Prisma.sql`${t}."priority" = ${scope.priority}`);
  if (scope.departmentId) {
    c.push(
      Prisma.sql`${t}."teamId" IN (SELECT t2.id FROM teams t2 WHERE t2."organizationId" = ${scope.orgId} AND t2."departmentId" = ${scope.departmentId})`
    );
  }
  if (scope.memberId) {
    c.push(
      Prisma.sql`EXISTS (SELECT 1 FROM task_assignees ta2 WHERE ta2."taskId" = ${t}.id AND ta2."memberId" = ${scope.memberId})`
    );
  }
  return c;
}

function bucketExpr(g: EvolutionGranularity): Prisma.Sql {
  if (g === "week") return Prisma.sql`date_trunc('week', tk."completedAt")`;
  if (g === "month") return Prisma.sql`date_trunc('month', tk."completedAt")`;
  return Prisma.sql`date_trunc('day', tk."completedAt")`;
}

export async function getTaskEvolution(
  scope: IndicatorScope,
  granularity: EvolutionGranularity,
  range: DateRange | null
): Promise<{ bucket: string; total: number }[]> {
  if (!range?.from) return [];
  const conditions = taskSqlConditions(scope, range, "tk");
  const whereSql = Prisma.join(conditions, " AND ");
  const rows = await prisma.$queryRaw<
    { bucket: Date; total: number }[]
  >`
    SELECT ${bucketExpr(granularity)} AS bucket, count(*)::int AS total
    FROM tasks tk
    WHERE ${whereSql} AND tk."completedAt" IS NOT NULL AND tk."completedAt" >= ${range.from}
    GROUP BY bucket
    ORDER BY bucket ASC
  `;
  return rows.map((r) => ({
    bucket: r.bucket.toISOString().slice(0, 10),
    total: Number(r.total),
  }));
}

// ------------------------------------------------------------
// EVOLUÇÃO DAS TAREFAS CRIADAS × CONCLUÍDAS (dashboard)
// ------------------------------------------------------------

export type FlowPoint = { bucket: string; created: number; completed: number };

export async function getTaskFlowEvolution(
  scope: IndicatorScope,
  granularity: EvolutionGranularity,
  range: DateRange | null
): Promise<FlowPoint[]> {
  if (!range?.from) return [];
  const conditions = taskSqlConditions(scope, range, "tk");
  const whereSql = Prisma.join(conditions, " AND ");
  const [createdRows, completedRows] = await Promise.all([
    prisma.$queryRaw<{ bucket: Date; total: number }[]>`
      SELECT ${bucketExpr(granularity)} AS bucket, count(*)::int AS total
      FROM tasks tk
      WHERE ${whereSql}
      GROUP BY bucket
      ORDER BY bucket ASC
    `,
    prisma.$queryRaw<{ bucket: Date; total: number }[]>`
      SELECT ${bucketExpr(granularity)} AS bucket, count(*)::int AS total
      FROM tasks tk
      WHERE ${whereSql} AND tk."completedAt" IS NOT NULL AND tk."completedAt" >= ${range.from}
      GROUP BY bucket
      ORDER BY bucket ASC
    `,
  ]);
  const byBucket = new Map<string, FlowPoint>();
  for (const r of createdRows) {
    const key = r.bucket.toISOString().slice(0, 10);
    const prev = byBucket.get(key);
    byBucket.set(key, { bucket: key, created: Number(r.total), completed: prev?.completed ?? 0 });
  }
  for (const r of completedRows) {
    const key = r.bucket.toISOString().slice(0, 10);
    const prev = byBucket.get(key);
    byBucket.set(key, { bucket: key, created: prev?.created ?? 0, completed: Number(r.total) });
  }
  return [...byBucket.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
}

// ------------------------------------------------------------
// RESULTADOS POR EQUIPE (métricas objetivas, ordenadas pelo usuário)
// ------------------------------------------------------------

export type TeamRow = {
  id: string;
  name: string;
  total: number;
  done: number;
  overdue: number;
  rate: number | null;
};

export async function getTeamBoard(scope: IndicatorScope, range: DateRange | null): Promise<TeamRow[]> {
  const base = buildTaskWhere(scope, range);
  const where = { ...base, teamId: scope.teamId ?? { not: null } } as TaskWhere;
  const whereDone = { ...where, status: "DONE" } as TaskWhere;
  const whereOverdue = {
    ...base,
    AND: [{ status: { not: "DONE" } }, { dueDate: { lt: new Date() } }],
  } as TaskWhere;
  const [teams, total, done, overdue] = await Promise.all([
    prisma.team.findMany({
      where: { organizationId: scope.orgId, archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.task.groupBy({ by: ["teamId"], where, _count: { _all: true } }),
    prisma.task.groupBy({ by: ["teamId"], where: whereDone, _count: { _all: true } }),
    prisma.task.groupBy({ by: ["teamId"], where: whereOverdue, _count: { _all: true } }),
  ]);
  const acc = (rows: { teamId: string | null; _count: { _all: number } }[]) =>
    new Map(rows.map((r) => [r.teamId!, r._count._all]));
  const mTotal = acc(total);
  const mDone = acc(done);
  const mOverdue = acc(overdue);
  return teams.map((t) => {
    const tot = mTotal.get(t.id) ?? 0;
    return {
      id: t.id,
      name: t.name,
      total: tot,
      done: mDone.get(t.id) ?? 0,
      overdue: mOverdue.get(t.id) ?? 0,
      rate: completionRate(mDone.get(t.id) ?? 0, tot),
    };
  });
}

// ------------------------------------------------------------
// RESULTADOS POR COLABORADOR (métricas objetivas)
// ------------------------------------------------------------

export type MemberRow = {
  id: string;
  name: string;
  department: string | null;
  teamNames: string[];
  total: number;
  done: number;
  overdue: number;
  rate: number | null;
};

export async function getMemberBoard(scope: IndicatorScope, range: DateRange | null): Promise<MemberRow[]> {
  const [members, raw] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId: scope.orgId },
      include: {
        user: { select: { name: true } },
        department: { select: { name: true } },
        teamMembers: { include: { team: { select: { name: true } } } },
      },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.$queryRaw<{ id: string; total: number; done: number; overdue: number }[]>`
      SELECT ta."memberId" AS id,
        count(*)::int AS total,
        count(*) FILTER (WHERE tk."status" = 'DONE')::int AS done,
        count(*) FILTER (WHERE tk."status" <> 'DONE' AND tk."dueDate" < now())::int AS overdue
      FROM task_assignees ta
      JOIN tasks tk ON tk.id = ta."taskId"
      WHERE ${Prisma.join(taskSqlConditions(scope, range, "tk"), " AND ")}
      GROUP BY ta."memberId"
    `,
  ]);
  const byId = new Map(raw.map((r) => [r.id, r]));
  return members.map((m) => {
    const r = byId.get(m.id);
    return {
      id: m.id,
      name: m.user.name,
      department: m.department?.name ?? null,
      teamNames: m.teamMembers.map((tm) => tm.team.name),
      total: r?.total ?? 0,
      done: r?.done ?? 0,
      overdue: r?.overdue ?? 0,
      rate: completionRate(r?.done ?? 0, r?.total ?? 0),
    };
  });
}

// ------------------------------------------------------------
// RESULTADOS POR PROJETO (progresso derivado das tarefas)
// ------------------------------------------------------------

export type ProjectRow = {
  id: string;
  name: string;
  status: string;
  priority: string;
  responsibleName: string | null;
  teamName: string | null;
  dueDate: Date | null;
  total: number;
  done: number;
  overdue: number;
  progress: number;
  isOverdue: boolean;
};

export async function getProjectBoard(scope: IndicatorScope, range: DateRange | null): Promise<ProjectRow[]> {
  const base = buildTaskWhere(scope, range);
  const where = { ...base, projectId: scope.projectId ?? { not: null } } as TaskWhere;
  const whereDone = { ...where, status: "DONE" } as TaskWhere;
  const whereOverdue = {
    ...base,
    AND: [{ status: { not: "DONE" } }, { dueDate: { lt: new Date() } }],
  } as TaskWhere;
  const [projects, total, done, overdue] = await Promise.all([
    prisma.project.findMany({
      where: { organizationId: scope.orgId },
      include: {
        responsible: { include: { user: { select: { name: true } } } },
        team: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.task.groupBy({ by: ["projectId"], where, _count: { _all: true } }),
    prisma.task.groupBy({ by: ["projectId"], where: whereDone, _count: { _all: true } }),
    prisma.task.groupBy({ by: ["projectId"], where: whereOverdue, _count: { _all: true } }),
  ]);
  const acc = (rows: { projectId: string | null; _count: { _all: number } }[]) =>
    new Map(rows.map((r) => [r.projectId!, r._count._all]));
  const mTotal = acc(total);
  const mDone = acc(done);
  const mOverdue = acc(overdue);
  return projects.map((p) => {
    const tot = mTotal.get(p.id) ?? 0;
    const d = mDone.get(p.id) ?? 0;
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      priority: p.priority,
      responsibleName: p.responsible?.user?.name ?? null,
      teamName: p.team?.name ?? null,
      dueDate: p.dueDate,
      total: tot,
      done: d,
      overdue: mOverdue.get(p.id) ?? 0,
      progress: progressPercent(d, tot),
      isOverdue: isProjectOverdue(p.status, p.dueDate),
    };
  });
}

// ------------------------------------------------------------
// METAS
// ------------------------------------------------------------

export type GoalRow = {
  id: string;
  title: string;
  status: string;
  startValue: number;
  targetValue: number;
  progress: number;
  currentValue: number;
  dueDate: Date | null;
  responsibleName: string | null;
  teamName: string | null;
  atRisk: boolean;
};

function goalWhere(scope: IndicatorScope): Prisma.GoalWhereInput {
  return {
    organizationId: scope.orgId,
    ...(scope.teamId ? { teamId: scope.teamId } : {}),
    ...(scope.departmentId ? { team: { departmentId: scope.departmentId } } : {}),
    ...(scope.memberId
      ? { OR: [{ responsibleId: scope.memberId }, { members: { some: { memberId: scope.memberId } } }] }
      : {}),
  };
}

/**
 * Valor atual derivado do progresso armazenado (não existe campo dedicado
 * de valor atual na meta — o progresso já reflete a evolução sobre o alvo).
 */
export function goalCurrentValue(progress: number, targetValue: number): number {
  return Math.round(targetValue * (progress / 100) * 100) / 100;
}

export async function getGoalRows(scope: IndicatorScope): Promise<GoalRow[]> {
  const goals = await prisma.goal.findMany({
    where: goalWhere(scope),
    include: {
      responsible: { include: { user: { select: { name: true } } } },
      team: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return goals.map((g) => ({
    id: g.id,
    title: g.title,
    status: g.status,
    startValue: g.startValue,
    targetValue: g.targetValue,
    progress: g.progress,
    currentValue: goalCurrentValue(g.progress, g.targetValue),
    dueDate: g.dueDate,
    responsibleName: g.responsible?.user?.name ?? null,
    teamName: g.team?.name ?? null,
    atRisk: isGoalAtRisk(g.status, g.dueDate, g.progress),
  }));
}

// ------------------------------------------------------------
// RESUMO (cards principais: tarefas · projetos · metas)
// ------------------------------------------------------------

export type OrgSummary = {
  tasks: TaskMetric;
  projects: {
    active: number;
    concluded: number;
    overdue: number;
    planning: number;
    paused: number;
  };
  goals: {
    total: number;
    inProgress: number;
    concluded: number;
    atRisk: number;
  };
};

export async function getOrgSummary(scope: IndicatorScope, range: DateRange | null): Promise<OrgSummary> {
  const pWhere = buildProjectWhere(scope, range);
  const gWhere = goalWhere(scope);
  const [tasks, active, concluded, planning, paused, pOverdue, goalTotals, inProgress, goalConcluded, atRisk] =
    await Promise.all([
      getTaskMetrics(scope, range),
      prisma.project.count({ where: { ...pWhere, status: { in: ["EM_ANDAMENTO", "PLANEJAMENTO"] } as never } }),
      prisma.project.count({ where: { ...pWhere, status: "CONCLUIDO" as never } }),
      prisma.project.count({ where: { ...pWhere, status: "PLANEJAMENTO" as never } }),
      prisma.project.count({ where: { ...pWhere, status: "PAUSADO" as never } }),
      prisma.project.count({ where: { ...pWhere, AND: [{ dueDate: { lt: new Date() } }, { status: { not: "CONCLUIDO" as never } }] } }),
      prisma.goal.count({ where: gWhere }),
      prisma.goal.count({ where: { ...gWhere, status: "EM_ANDAMENTO" as never } }),
      prisma.goal.count({ where: { ...gWhere, status: "CONCLUIDO" as never } }),
      prisma.goal.count({
        where: {
          ...gWhere,
          status: "EM_ANDAMENTO" as never,
          dueDate: { lte: new Date(new Date().getTime() + 14 * 86400000) },
          progress: { lt: 80 },
        },
      }),
    ]);
  return {
    tasks,
    projects: { active, concluded, overdue: pOverdue, planning, paused },
    goals: { total: goalTotals, inProgress, concluded: goalConcluded, atRisk },
  };
}