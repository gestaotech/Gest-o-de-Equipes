import type { TaskPriority, TaskStatus } from "@prisma/client";

// ------------------------------------------------------------
// INDICADORES — núcleo puro (períodos, taxas, regras objetivas).
// Testável sem banco. As consultas ficam em indicator-queries.ts.
// ------------------------------------------------------------

export type ReportPeriod =
  | "today"
  | "7d"
  | "30d"
  | "90d"
  | "month"
  | "prevMonth"
  | "quarter"
  | "year"
  | "custom";

export const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "month", label: "Este mês" },
  { value: "prevMonth", label: "Mês anterior" },
  { value: "quarter", label: "Este trimestre" },
  { value: "year", label: "Este ano" },
  { value: "custom", label: "Personalizado" },
];

export type DateRange = { from: Date; to?: Date };

/**
 * Regra de período aplicada aos indicadores:
 * o filtro incide sobre a data de criação (tasks.createdAt /
 * projects.createdAt). O gráfico de conclusão usa completedAt.
 */
export function periodRange(
  period: ReportPeriod,
  from?: string,
  to?: string
): DateRange | null {
  const now = new Date();
  switch (period) {
    case "custom": {
      if (!from || !to) return null;
      const f = new Date(`${from}T00:00:00`);
      const t = new Date(`${to}T00:00:00`);
      if (isNaN(f.getTime()) || isNaN(t.getTime()) || t < f) return null;
      const end = new Date(t.getTime());
      end.setDate(end.getDate() + 1);
      return { from: f, to: end };
    }
    case "today": {
      const f = new Date(now);
      f.setHours(0, 0, 0, 0);
      return { from: f };
    }
    case "7d":
      return { from: daysAgo(now, 7) };
    case "30d":
      return { from: daysAgo(now, 30) };
    case "90d":
      return { from: daysAgo(now, 90) };
    case "month": {
      const f = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: f };
    }
    case "prevMonth": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to };
    }
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      return { from: new Date(now.getFullYear(), q * 3, 1) };
    }
    case "year":
      return { from: new Date(now.getFullYear(), 0, 1) };
  }
}

function daysAgo(now: Date, days: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Taxa de conclusão em % (1 casa). null quando não há dados ("Sem dados" ≠ 0%). */
export function completionRate(done: number, total: number): number | null {
  if (!total || total <= 0) return null;
  return Math.round((done / total) * 1000) / 10;
}

export function progressPercent(done: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((done / total) * 100)));
}

/** Tarefa atrasada: não concluída E vencida. */
export function isTaskOverdue(
  status: TaskStatus | string,
  dueDate: Date | null | undefined,
  now: Date = new Date()
): boolean {
  return status !== "DONE" && Boolean(dueDate) && dueDate!.getTime() < now.getTime();
}

/** Projeto atrasado: prazo vencido e ainda não concluído. */
export function isProjectOverdue(
  status: string,
  dueDate: Date | null | undefined,
  now: Date = new Date()
): boolean {
  return status !== "CONCLUIDO" && Boolean(dueDate) && dueDate!.getTime() < now.getTime();
}

/**
 * REGRA DE META EM RISCO (objetiva e documentada):
 * status EM_ANDAMENTO + prazo a até 14 dias + progresso abaixo de 80%.
 */
export const AT_RISK_DAYS = 14;
export const AT_RISK_PROGRESS = 80;

export function isGoalAtRisk(
  status: string,
  dueDate: Date | null | undefined,
  progress: number,
  now: Date = new Date()
): boolean {
  if (status !== "EM_ANDAMENTO") return false;
  if (!dueDate) return false;
  const limit = new Date(now.getTime() + AT_RISK_DAYS * 86400000);
  return dueDate.getTime() <= limit.getTime() && progress < AT_RISK_PROGRESS;
}

export const TASK_STATUS_ORDER: TaskStatus[] = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
];

export const TASK_PRIORITY_ORDER: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export const PROJECT_STATUS_ORDER = ["PLANEJAMENTO", "EM_ANDAMENTO", "PAUSADO", "CONCLUIDO"] as const;