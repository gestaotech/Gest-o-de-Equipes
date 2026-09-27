import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { formatDate } from "@/lib/utils";
import type { DateRange, ReportPeriod } from "@/lib/indicator-metrics";
import {
  buildTaskWhere,
  getGoalRows,
  getMemberBoard,
  getProjectBoard,
  getTeamBoard,
  type GoalRow,
  type IndicatorScope,
  type ProjectRow,
} from "@/lib/indicator-queries";

// ------------------------------------------------------------
// RELATÓRIOS — linhas prontas para UI e exportação CSV.
// Resultado sempre derivado de getOrg (sessão), multi-tenant.
// ------------------------------------------------------------

export type ReportKind = "tasks" | "projects" | "teams" | "members" | "goals";

export const REPORT_KINDS: { value: ReportKind; label: string; description: string }[] = [
  { value: "tasks", label: "Tarefas", description: "Tarefas com status, prioridade e prazos." },
  { value: "projects", label: "Projetos", description: "Projetos com progresso e tarefas." },
  { value: "teams", label: "Equipes", description: "Métricas objetivas por equipe." },
  { value: "members", label: "Colaboradores", description: "Métricas objetivas por colaborador." },
  { value: "goals", label: "Metas", description: "Metas com progresso e situação." },
];

export type TaskReportRow = {
  title: string;
  project: string | null;
  responsible: string | null;
  team: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  createdAt: Date;
  completedAt: Date | null;
};

export async function getTaskReportRows(
  scope: IndicatorScope,
  range: DateRange | null
): Promise<TaskReportRow[]> {
  const tasks = await prisma.task.findMany({
    where: buildTaskWhere(scope, range),
    include: {
      project: { select: { name: true } },
      team: { select: { name: true } },
      assignees: { include: { member: { include: { user: { select: { name: true } } } } } },
      createdBy: { select: { name: true } },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });
  return tasks.map((t) => ({
    title: t.title,
    project: t.project?.name ?? null,
    responsible: t.assignees[0]?.member.user.name ?? t.createdBy?.name ?? null,
    team: t.team?.name ?? null,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    createdAt: t.createdAt,
    completedAt: t.completedAt,
  }));
}

export type TeamReportRow = {
  name: string;
  department: string | null;
  membersCount: number;
  projectsCount: number;
  total: number;
  done: number;
  overdue: number;
  rate: number | null;
};

export async function getTeamReportRows(
  scope: IndicatorScope,
  range: DateRange | null
): Promise<TeamReportRow[]> {
  const [board, teams, projectCounts] = await Promise.all([
    getTeamBoard(scope, range),
    prisma.team.findMany({
      where: { organizationId: scope.orgId, archivedAt: null },
      include: {
        department: { select: { name: true } },
        _count: { select: { members: true } },
      },
    }),
    prisma.project.groupBy({
      by: ["teamId"],
      where: { organizationId: scope.orgId, teamId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const projectsByTeam = new Map(projectCounts.map((r) => [r.teamId, r._count._all]));
  const byId = new Map(board.map((b) => [b.id, b]));
  return teams.map((t) => {
    const b = byId.get(t.id);
    return {
      name: t.name,
      department: t.department?.name ?? null,
      membersCount: t._count.members,
      projectsCount: projectsByTeam.get(t.id) ?? 0,
      total: b?.total ?? 0,
      done: b?.done ?? 0,
      overdue: b?.overdue ?? 0,
      rate: b?.rate ?? null,
    };
  });
}

export type MemberReportRow = {
  name: string;
  department: string | null;
  teamNames: string[];
  total: number;
  done: number;
  overdue: number;
  projectsCount: number;
  goalsCount: number;
  rate: number | null;
};

export async function getMemberReportRows(
  scope: IndicatorScope,
  range: DateRange | null
): Promise<MemberReportRow[]> {
  const [board, projectCounts, goalCounts] = await Promise.all([
    getMemberBoard(scope, range),
    prisma.projectMember.groupBy({
      by: ["memberId"],
      where: { project: { organizationId: scope.orgId } },
      _count: { _all: true },
    }),
    prisma.goalMember.groupBy({
      by: ["memberId"],
      where: { goal: { organizationId: scope.orgId } },
      _count: { _all: true },
    }),
  ]);
  const p = new Map(projectCounts.map((r) => [r.memberId, r._count._all]));
  const g = new Map(goalCounts.map((r) => [r.memberId, r._count._all]));
  return board.map((b) => ({
    name: b.name,
    department: b.department,
    teamNames: b.teamNames,
    total: b.total,
    done: b.done,
    overdue: b.overdue,
    projectsCount: p.get(b.id) ?? 0,
    goalsCount: g.get(b.id) ?? 0,
    rate: b.rate,
  }));
}

export function goalReportRows(scope: IndicatorScope) {
  return getGoalRows(scope);
}

export function reportRows(kind: ReportKind, scope: IndicatorScope, range: DateRange | null) {
  switch (kind) {
    case "tasks":
      return getTaskReportRows(scope, range);
    case "projects":
      return getProjectBoard(scope, range);
    case "teams":
      return getTeamReportRows(scope, range);
    case "members":
      return getMemberReportRows(scope, range);
    case "goals":
      return getGoalRows(scope);
  }
}

export type Periodish = { period: ReportPeriod; from?: string; to?: string };

// ------------------------------------------------------------
// Exportação CSV (headers + valores por tipo de relatório)
// ------------------------------------------------------------

export function exportCsv(kind: ReportKind, rows: readonly unknown[]): string {
  const fallback: [string[], (string | number | null | boolean)[][]] = [[], []];

  const byKind: Record<ReportKind, [string[], (string | number | null | boolean)[][]]> = {
    tasks: [
      ["Título", "Projeto", "Responsável", "Equipe", "Status", "Prioridade", "Prazo", "Criada", "Concluída"],
      (rows as TaskReportRow[]).map((r) => [
        r.title,
        r.project ?? "",
        r.responsible ?? "",
        r.team ?? "",
        r.status,
        r.priority,
        formatDate(r.dueDate),
        formatDate(r.createdAt),
        formatDate(r.completedAt),
      ]),
    ],
    projects: [
      ["Nome", "Responsável", "Equipe", "Status", "Prioridade", "Prazo", "Tarefas", "Concluídas", "Atrasadas", "Progresso (%)", "Situação"],
      (rows as ProjectRow[]).map((r) => [
        r.name,
        r.responsibleName ?? "",
        r.teamName ?? "",
        r.status,
        r.priority,
        formatDate(r.dueDate),
        r.total,
        r.done,
        r.overdue,
        r.progress,
        r.isOverdue ? "Atrasado" : "Em dia",
      ]),
    ],
    teams: [
      ["Equipe", "Departamento", "Membros", "Tarefas", "Concluídas", "Atrasadas", "Taxa (%)"],
      (rows as TeamReportRow[]).map((r) => [
        r.name,
        r.department ?? "",
        r.membersCount,
        r.total,
        r.done,
        r.overdue,
        r.rate ?? "",
      ]),
    ],
    members: [
      ["Nome", "Departamento", "Equipes", "Tarefas", "Concluídas", "Atrasadas", "Projetos", "Metas", "Taxa (%)"],
      (rows as MemberReportRow[]).map((r) => [
        r.name,
        r.department ?? "",
        r.teamNames.join(", "),
        r.total,
        r.done,
        r.overdue,
        r.projectsCount,
        r.goalsCount,
        r.rate ?? "",
      ]),
    ],
    goals: [
      ["Meta", "Responsável", "Equipe", "Status", "Progresso (%)", "Situação"],
      (rows as GoalRow[]).map((r) => [
        r.title,
        r.responsibleName ?? "",
        r.teamName ?? "",
        r.status,
        r.progress,
        r.atRisk ? "Em risco" : "Ok",
      ]),
    ],
  };

  const [headers, values] = byKind[kind] ?? fallback;
  return toCsv(headers, values);
}