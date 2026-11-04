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
import {
  goalVisibilityWhere,
  projectVisibilityWhere,
  taskVisibilityWhere,
  teamVisibilityWhere,
  visibleMembersWhere,
  type DataScope,
} from "@/server/scope/rules";

// ------------------------------------------------------------
// INDICADORES — consultas/agregações no banco (COUNT · GROUP BY).
//
// PERMISSION x SCOPE (fase 1.1):
//   - PERMISSION: quem pode abrir o módulo (permits → RBAC).
//   - SCOPE:      `scope.restrict` (Data Scope) delimita QUAIS linhas o
//                 usuário enxerga. Sem ele, a consulta é organizacional.
//
// orgId é derivado da sessão no servidor, nunca do frontend.
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
  /**
   * Data Scope do usuário. Quando presente, TODA a consulta é restringida
   * ao que ele pode ver. Quando ausente, assume escopo organizacional —
   * use apenas emRotinas administrativas já protegidas por RBAC.
   */
  restrict?: DataScope;
};

/** Escopo organizacional explícito (uso administrativo). */
export function orgWideScope(scope: Omit<IndicatorScope, "restrict">): IndicatorScope {
  return { ...scope };
}

export type TaskWhere = Prisma.TaskWhereInput;

/**
 * Base de visibilidade. Sem `restrict`, o escopo é a organização inteira
 * (comportamento administrativo preservado).
 */
function baseWhere<T>(
  scope: IndicatorScope,
  restricted: (s: DataScope) => T
): T & { organizationId: string } {
  const base = scope.restrict ? restricted(scope.restrict) : ({} as T);
  return { ...base, organizationId: scope.orgId };
}

export function buildTaskWhere(scope: IndicatorScope, range: DateRange | null): TaskWhere {
  return {
    ...baseWhere(scope, taskVisibilityWhere),
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
    ...baseWhere(scope, projectVisibilityWhere),
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

/**
 * Tradução SQL das MESMAS regras de `taskVisibilityWhere` (rules.ts).
 * Mantida aqui porque as evoluções/agregações usam SQL bruto.
 * `organizationId` sozinho nunca autoriza: exige atribuição, autoria ou
 * relação com projeto/equipe dentro do escopo do usuário.
 */
function taskVisibilitySql(s: DataScope, alias: string): Prisma.Sql | null {
  if (s.level === "ORG") return null;
  const t = Prisma.raw(alias);
  const m = s.memberId;
  const u = s.userId;

  const projectVisible = Prisma.sql`EXISTS (
    SELECT 1 FROM projects pv
    WHERE pv.id = ${t}."projectId"
      AND (
        pv."responsibleId" = ${m}
        OR EXISTS (SELECT 1 FROM project_members pvm WHERE pvm."projectId" = pv.id AND pvm."memberId" = ${m})
        ${
          s.level === "LEAD"
            ? Prisma.sql`OR EXISTS (SELECT 1 FROM teams pvt WHERE pvt.id = pv."teamId" AND pvt."leadId" = ${m})`
            : Prisma.empty
        }
      )
  )`;

  const rel: Prisma.Sql[] = [
    Prisma.sql`EXISTS (SELECT 1 FROM task_assignees tav WHERE tav."taskId" = ${t}.id AND tav."memberId" = ${m})`,
    Prisma.sql`${t}."createdById" = ${u}`,
    projectVisible,
    Prisma.sql`EXISTS (SELECT 1 FROM team_members tmev WHERE tmev."teamId" = ${t}."teamId" AND tmev."memberId" = ${m})`,
  ];
  if (s.level === "LEAD") {
    // Tarefa de uma equipe que o LEAD lidera.
    rel.push(Prisma.sql`EXISTS (SELECT 1 FROM teams tll WHERE tll.id = ${t}."teamId" AND tll."leadId" = ${m})`);
  }
  return Prisma.sql`(${Prisma.join(rel, " OR ")})`;
}

/**
 * Coluna temporal usada para o filtro de período e o agrupamento.
 * "createdAt" para tarefas criadas, "completedAt" para tarefas concluídas.
 * São conceitos distintos e NÃO devem ser misturados.
 */
type TaskDateColumn = "createdAt" | "completedAt";

/** Condições SQL de tarefa. `dateColumn` define a coluna do filtro de período. */
export function taskSqlConditions(
  scope: IndicatorScope,
  range: DateRange | null,
  alias: string,
  dateColumn: TaskDateColumn = "createdAt"
): Prisma.Sql[] {
  const t = Prisma.raw(alias);
  const c: Prisma.Sql[] = [Prisma.sql`${t}."organizationId" = ${scope.orgId}`];
  if (scope.restrict) {
    const vis = taskVisibilitySql(scope.restrict, alias);
    if (vis) c.push(vis);
  }
  // O período incide sobre a coluna pedida: uma tarefa concluída dentro da
  // janela entra na série de concluídas mesmo que tenha sido criada antes.
  if (range?.from) {
    const col = Prisma.raw(`"${dateColumn}"`);
    c.push(
      range.to
        ? Prisma.sql`${t}.${col} >= ${range.from} AND ${t}.${col} < ${range.to}`
        : Prisma.sql`${t}.${col} >= ${range.from}`
    );
  }
  if (dateColumn === "completedAt") c.push(Prisma.sql`${t}."completedAt" IS NOT NULL`);
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

/**
 * Bucket do eixo temporal, truncado sobre a coluna pedida.
 * O truncamento roda em UTC e o texto resultante é gerado no próprio SQL,
 * evitando que a conversão para o fuso do servidor desloque o dia/bucket.
 */
export function bucketExpr(
  g: EvolutionGranularity,
  dateColumn: TaskDateColumn = "completedAt"
): Prisma.Sql {
  const unit = g === "week" ? "week" : g === "month" ? "month" : "day";
  const col = Prisma.raw(`"${dateColumn}"`);
  return Prisma.sql`to_char(date_trunc('${Prisma.raw(unit)}', tk.${col} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`;
}

/**
 * Evolução de tarefas CONCLUÍDAS. O período e o bucket usam `completedAt`.
 * Tarefas concluídas dentro da janela entram mesmo se criadas antes dela.
 */
export async function getTaskEvolution(
  scope: IndicatorScope,
  granularity: EvolutionGranularity,
  range: DateRange | null
): Promise<{ bucket: string; total: number }[]> {
  if (!range?.from) return [];
  const conditions = taskSqlConditions(scope, range, "tk", "completedAt");
  const whereSql = Prisma.join(conditions, " AND ");
  const rows = await prisma.$queryRaw<{ bucket: string; total: number }[]>`
    SELECT ${bucketExpr(granularity, "completedAt")} AS bucket, count(*)::int AS total
    FROM tasks tk
    WHERE ${whereSql}
    GROUP BY bucket
    ORDER BY bucket ASC
  `;
  return rows.map((r) => ({ bucket: r.bucket, total: Number(r.total) }));
}

// ------------------------------------------------------------
// EVOLUÇÃO DAS TAREFAS CRIADAS × CONCLUÍDAS (dashboard)
// ------------------------------------------------------------

export type FlowPoint = { bucket: string; created: number; completed: number };

/**
 * Evolução de tarefas CRIADAS × CONCLUÍDAS.
 *
 * Séries independentes, cada uma com sua própria coluna temporal:
 *   criadas    → createdAt   (sem exigir completedAt)
 *   concluídas → completedAt (exige completedAt IS NOT NULL)
 *
 * Uma tarefa criada dentro da janela e concluída fora NÃO aparece como
 * concluída dentro da janela; uma concluída dentro da janela aparece mesmo
 * que tenha sido criada antes.
 */
export async function getTaskFlowEvolution(
  scope: IndicatorScope,
  granularity: EvolutionGranularity,
  range: DateRange | null
): Promise<FlowPoint[]> {
  if (!range?.from) return [];
  const createdSql = Prisma.join(taskSqlConditions(scope, range, "tk", "createdAt"), " AND ");
  const completedSql = Prisma.join(taskSqlConditions(scope, range, "tk", "completedAt"), " AND ");
  const [createdRows, completedRows] = await Promise.all([
    prisma.$queryRaw<{ bucket: string; total: number }[]>`
      SELECT ${bucketExpr(granularity, "createdAt")} AS bucket, count(*)::int AS total
      FROM tasks tk
      WHERE ${createdSql}
      GROUP BY bucket
      ORDER BY bucket ASC
    `,
    prisma.$queryRaw<{ bucket: string; total: number }[]>`
      SELECT ${bucketExpr(granularity, "completedAt")} AS bucket, count(*)::int AS total
      FROM tasks tk
      WHERE ${completedSql}
      GROUP BY bucket
      ORDER BY bucket ASC
    `,
  ]);

  const byBucket = new Map<string, FlowPoint>();
  const point = (key: string) => {
    let p = byBucket.get(key);
    if (!p) {
      p = { bucket: key, created: 0, completed: 0 };
      byBucket.set(key, p);
    }
    return p;
  };
  for (const r of createdRows) point(r.bucket).created = Number(r.total);
  for (const r of completedRows) point(r.bucket).completed = Number(r.total);

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
  // Atrasadas derivam do MESMO filtro da lista (inclusive teamId), senão a
  // coluna "atrasadas" contaria tarefas fora do recorte exibido.
  const whereOverdue = {
    ...where,
    status: { not: "DONE" },
    dueDate: { lt: new Date() },
  } as TaskWhere;
  const [teams, total, done, overdue] = await Promise.all([
    prisma.team.findMany({
      where: scope.restrict
        ? { ...teamVisibilityWhere(scope.restrict), archivedAt: null }
        : { organizationId: scope.orgId, archivedAt: null },
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
      where: scope.restrict ? visibleMembersWhere(scope.restrict) : { organizationId: scope.orgId },
      include: {
        user: { select: { name: true } },
        department: { select: { name: true } },
        teamMembers: { include: { team: { select: { name: true } } } },
      },
      orderBy: { joinedAt: "asc" },
    }),
    (prisma.$queryRaw as unknown as (args: unknown) => Promise<unknown>)(`
      SELECT ta."memberId" AS id,
        count(*)::int AS total,
        count(*) FILTER (WHERE tk."status" = 'DONE')::int AS done,
        count(*) FILTER (WHERE tk."status" <> 'DONE' AND tk."dueDate" < now())::int AS overdue
      FROM task_assignees ta
      JOIN tasks tk ON tk.id = ta."taskId"
      WHERE ${Prisma.join(taskSqlConditions(scope, range, "tk", "createdAt"), " AND ")}
      GROUP BY ta."memberId"
    `) as Promise<{ id: string; total: number; done: number; overdue: number }[]>,
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
    ...where,
    status: { not: "DONE" },
    dueDate: { lt: new Date() },
  } as TaskWhere;
  const [projects, total, done, overdue] = await Promise.all([
    prisma.project.findMany({
      where: buildProjectWhere(scope, null),
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
  const base = scope.restrict ? goalVisibilityWhere(scope.restrict) : { organizationId: scope.orgId };
  return {
    ...base,
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

// ------------------------------------------------------------
// NOVOS INDICADORES AVANÇADOS (Fase 7)
// ------------------------------------------------------------

export type ProductivityMetric = {
  memberId: string;
  memberName: string;
  tasksCompleted: number;
  tasksCreated: number;
  avgDaysToComplete: number | null;
  onTimeRate: number | null;
};

/**
 * Produtividade por colaborador dentro do escopo.
 * Retorna tarefas concluídas, criadas, tempo médio para concluir e taxa de entrega no prazo.
 */
export async function getProductivityByMember(
  scope: IndicatorScope,
  range: DateRange | null
): Promise<ProductivityMetric[]> {
  const [members, raw] = await Promise.all([
    prisma.organizationMember.findMany({
      where: scope.restrict ? visibleMembersWhere(scope.restrict) : { organizationId: scope.orgId },
      include: { user: { select: { name: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    (prisma.$queryRaw as unknown as (args: unknown) => Promise<unknown>)(`
      SELECT ta."memberId" AS id,
        count(*) FILTER (WHERE tk."status" = 'DONE')::int AS completed,
        count(*)::int AS created,
        round(avg(EXTRACT(EPOCH FROM (tk."completedAt" - tk."createdAt")) / 86400.0)::numeric, 2)::text AS avg_days,
        round(
          100.0 * count(*) FILTER (WHERE tk."status" = 'DONE' AND tk."dueDate" >= tk."completedAt")::float
          / nullif(count(*) FILTER (WHERE tk."status" = 'DONE'), 0)::float, 2
        )::text AS ontime_rate
      FROM task_assignees ta
      JOIN tasks tk ON tk.id = ta."taskId"
      WHERE ${Prisma.join(taskSqlConditions(scope, range, "tk", "createdAt"), " AND ")}
      GROUP BY ta."memberId"
    `) as Promise<{
      id: string;
      completed: number;
      created: number;
      avg_days: string;
      ontime_rate: string;
    }[]>,
  ]);
  const byId = new Map(raw.map((r) => [r.id, r]));
  return members.map((m) => {
    const r = byId.get(m.id);
    return {
      memberId: m.id,
      memberName: m.user.name,
      tasksCompleted: r?.completed ?? 0,
      tasksCreated: r?.created ?? 0,
      avgDaysToComplete: r?.avg_days ? Number(r.avg_days) : null,
      onTimeRate: r?.ontime_rate ? Number(r.ontime_rate) : null,
    };
  });
}

export type DelayTrend = {
  bucket: string;
  overdueCount: number;
};

/**
 * Tendência de atraso ao longo do tempo (tarefas que passaram a ficar atrasadas em cada bucket).
 */
export async function getDelayTrend(
  scope: IndicatorScope,
  granularity: EvolutionGranularity,
  range: DateRange | null
): Promise<DelayTrend[]> {
  if (!range?.from) return [];
  const conditions = [
    Prisma.sql`tk."organizationId" = ${scope.orgId}`,
    Prisma.sql`tk."status" <> 'DONE'`,
    Prisma.sql`tk."dueDate" IS NOT NULL`,
    Prisma.sql`tk."dueDate" < ${new Date()}`,
  ];
  if (scope.restrict) {
    const vis = taskVisibilitySql(scope.restrict, "tk");
    if (vis) conditions.push(vis);
  }
  if (range.from) {
    conditions.push(
      range.to
        ? Prisma.sql`tk."dueDate" >= ${range.from} AND tk."dueDate" < ${range.to}`
        : Prisma.sql`tk."dueDate" >= ${range.from}`
    );
  }
  const whereSql = Prisma.join(conditions, " AND ");
  const rows = await prisma.$queryRaw<{ bucket: string; overdueCount: number }[]>`
    SELECT ${bucketExpr(granularity, "dueDate")} AS bucket, count(*)::int AS overdue_count
    FROM tasks tk
    WHERE ${whereSql}
    GROUP BY bucket
    ORDER BY bucket ASC
  `;
  return rows.map((r) => ({ bucket: r.bucket, overdueCount: Number(r.overdueCount) }));
}

export type GoalHealthMetric = {
  total: number;
  healthy: number;
  atRisk: number;
  critical: number;
};

/**
 * Saúde das metas: saudável (progresso >= 80%), em risco (50-79%), crítica (< 50%).
 */
export async function getGoalHealth(scope: IndicatorScope): Promise<GoalHealthMetric> {
  const where = goalWhere(scope);
  const goals = await prisma.goal.findMany({
    where,
    select: { status: true, progress: true, dueDate: true },
  });
  let healthy = 0;
  let atRisk = 0;
  let critical = 0;
  for (const g of goals) {
    if (g.status === "CONCLUIDO") {
      healthy++;
    } else if (g.progress >= 80) {
      healthy++;
    } else if (g.progress >= 50) {
      atRisk++;
    } else {
      critical++;
    }
  }
  return {
    total: goals.length,
    healthy,
    atRisk,
    critical,
  };
}

export type ProjectHealthMetric = {
  total: number;
  onTrack: number;
  atRisk: number;
  delayed: number;
};

/**
 * Saúde dos projetos: no prazo (progresso >= 80%), em risco (50-79%), atrasado (< 50% ou vencido).
 */
export async function getProjectHealth(scope: IndicatorScope): Promise<ProjectHealthMetric> {
  const where = buildProjectWhere(scope, null);
  const projects = await prisma.project.findMany({
    where,
    select: { status: true, progress: true, dueDate: true },
  });
  let onTrack = 0;
  let atRisk = 0;
  let delayed = 0;
  for (const p of projects) {
    if (p.status === "CONCLUIDO") {
      onTrack++;
    } else if (p.progress >= 80) {
      onTrack++;
    } else if (p.progress >= 50) {
      atRisk++;
    } else {
      delayed++;
    }
  }
  return {
    total: projects.length,
    onTrack,
    atRisk,
    delayed,
  };
}

// ------------------------------------------------------------
// RESUMO EXPANDIDO (Fase 7)
// ------------------------------------------------------------

export type ExpandedOrgSummary = OrgSummary & {
  productivity: ProductivityMetric[];
  goalHealth: GoalHealthMetric;
  projectHealth: ProjectHealthMetric;
  delayTrend: DelayTrend[];
};

export async function getExpandedOrgSummary(
  scope: IndicatorScope,
  range: DateRange | null,
  granularity: EvolutionGranularity = "week"
): Promise<ExpandedOrgSummary> {
  const [base, productivity, goalHealth, projectHealth, delayTrend] =
    await Promise.all([
      getOrgSummary(scope, range),
      getProductivityByMember(scope, range),
      getGoalHealth(scope),
      getProjectHealth(scope),
      getDelayTrend(scope, granularity, range),
    ]);
  return {
    ...base,
    productivity,
    goalHealth,
    projectHealth,
    delayTrend,
  };
}