import Link from "next/link";
import {
  Users,
  FolderKanban,
  ListTodo,
  CheckCircle2,
  CalendarClock,
  FileBarChart2,
  ChevronRight,
  AlertTriangle,
  Plus,
  Calendar,
  Rocket,
  TrendingUp,
} from "lucide-react";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { activityLabel } from "@/lib/activity-labels";
import { formatDate, formatRelative, cn } from "@/lib/utils";
import type { DistributionRow, FlowPoint, ProjectRow } from "@/lib/indicator-queries";
import type {
  DashboardActivity,
  DashboardEvent,
  DashboardKpis,
  DashboardTask,
} from "@/server/dashboard-data";

export const DASHBOARD_PERIODS = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "month", label: "Este mês" },
] as const;

type BadgeVariant = "default" | "secondary" | "outline" | "success" | "warning" | "destructive";

const TASK_STATUS_LABEL: Record<string, string> = {
  BACKLOG: "Backlog",
  TODO: "A fazer",
  IN_PROGRESS: "Em andamento",
  IN_REVIEW: "Em revisão",
  DONE: "Concluída",
};

const PRIORITY_LABEL: Record<string, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const PRIORITY_VARIANT: Record<string, BadgeVariant> = {
  LOW: "secondary",
  MEDIUM: "default",
  HIGH: "warning",
  URGENT: "destructive",
};

const STATUS_BAR_COLOR: Record<string, string> = {
  BACKLOG: "bg-slate-300",
  TODO: "bg-slate-400",
  IN_PROGRESS: "bg-blue-600",
  IN_REVIEW: "bg-amber-500",
  DONE: "bg-emerald-600",
};

const primaryLink =
  "inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const outlineLink =
  "inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3.5 py-2 text-sm font-medium text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Props = {
  userName: string;
  orgName: string;
  roleLabel: string;
  period: string;
  kpis: DashboardKpis | null;
  priorityTasks: DashboardTask[] | null;
  memberMode: boolean;
  activeProjects: ProjectRow[] | null;
  events: DashboardEvent[] | null;
  activity: DashboardActivity[] | null;
  flow: FlowPoint[] | null;
  statusDist: DistributionRow[] | null;
  canWriteTasks: boolean;
  canWriteProjects: boolean;
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function SectionError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center">
      <AlertTriangle className="h-6 w-6 text-amber-600" aria-hidden />
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Link href="/dashboard" className={cn(outlineLink, "mt-3")}>
        Tentar novamente
      </Link>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  href,
  icon,
  iconClass,
}: {
  label: string;
  value: string;
  hint?: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
}) {
  const Icon = icon;
  return (
    <Link href={href} className="group">
      <Card className="h-full transition hover:border-primary/40">
        <CardContent className="p-4">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-accent", iconClass)}>
            <Icon className="h-4 w-4" />
          </div>
          <p className="mt-3 text-2xl font-bold leading-none">{value}</p>
          <p className="mt-1.5 text-xs font-medium text-muted-foreground">{label}</p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground/80">{hint}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

function FlowLineChart({ points }: { points: FlowPoint[] }) {
  const W = 800;
  const H = 220;
  const PAD = { top: 18, right: 14, bottom: 28, left: 40 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const max = Math.max(1, ...points.flatMap((p) => [p.created, p.completed]));
  const n = points.length;
  const step = n > 1 ? innerW / (n - 1) : innerW;
  const labelEvery = n > 24 ? Math.ceil(n / 12) : n > 12 ? 2 : 1;

  const x = (i: number) => PAD.left + step * i;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const line = (key: "created" | "completed") =>
    points.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", minWidth: n > 0 ? 480 : undefined }}
        role="img"
        aria-label="Evolução de tarefas criadas e concluídas"
      >
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + innerH * f}
            y2={PAD.top + innerH * f}
            stroke="#e2e8f0"
            strokeWidth={1}
          />
        ))}
        {points.map((p, i) => {
          if (i % labelEvery !== 0) return null;
          return (
            <text key={p.bucket} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#64748b">
              {p.bucket.slice(5)}
            </text>
          );
        })}
        {points.length > 1 && (
          <>
            <polyline points={line("created")} fill="none" stroke="#2563EB" strokeWidth={2} />
            <polyline points={line("completed")} fill="none" stroke="#10B981" strokeWidth={2} />
          </>
        )}
        {n === 0 && (
          <text x={W / 2} y={innerH / 2 + PAD.top} textAnchor="middle" fontSize={13} fill="#64748b">
            Sem dados no período
          </text>
        )}
      </svg>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-600" aria-hidden /> Criadas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden /> Concluídas
        </span>
      </div>
    </div>
  );
}

function StatusBars({ rows }: { rows: DistributionRow[] }) {
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span>{TASK_STATUS_LABEL[r.key] ?? r.key}</span>
            <span className="text-muted-foreground">
              {r.count}
              {r.percent != null ? ` · ${r.percent}%` : ""}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", STATUS_BAR_COLOR[r.key] ?? "bg-blue-600")}
              style={{ width: `${r.percent ?? 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function daysLeft(due: Date | null): string | null {
  if (!due) return null;
  const diff = Math.ceil((due.getTime() - Date.now()) / 86400000);
  if (diff < 0) return "Atrasado";
  if (diff === 0) return "Vence hoje";
  return `Prazo: ${diff} dia${diff > 1 ? "s" : ""}`;
}

function dayLabel(d: Date): string {
  const isSameDay = (a: Date, b: Date) =>
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate();
  const now = new Date();
  if (isSameDay(d, now)) return "Hoje";
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (isSameDay(d, tomorrow)) return "Amanhã";
  return formatDate(d);
}

export function DashboardView({
  userName,
  orgName,
  roleLabel,
  period,
  kpis,
  priorityTasks,
  memberMode,
  activeProjects,
  events,
  activity,
  flow,
  statusDist,
  canWriteTasks,
  canWriteProjects,
}: Props) {
  const firstName = userName.split(" ")[0];
  const isEmpty =
    kpis != null && kpis.members === 0 && kpis.projectsActive === 0 && kpis.tasksTotal === 0;
  const hasAttention =
    kpis != null && (kpis.tasksOverdue > 0 || kpis.projectsOverdue > 0 || kpis.goalsAtRisk > 0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 lg:p-6">
      {/* Header / saudação / ações */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting()}, {firstName} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Aqui está um resumo da sua operação · {orgName} · {roleLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canWriteTasks && (
            <Link href="/app/tarefas?criar=1" className={primaryLink}>
              <Plus className="h-4 w-4" aria-hidden /> Nova tarefa
            </Link>
          )}
          {canWriteProjects && (
            <Link href="/app/projetos" className={outlineLink}>
              <FolderKanban className="h-4 w-4" aria-hidden /> Novo projeto
            </Link>
          )}
          <Link href="/app/agenda" className={outlineLink}>
            <Calendar className="h-4 w-4" aria-hidden /> Ver agenda
          </Link>
        </div>
      </div>

      {/* Primeiro acesso */}
      {isEmpty && kpis && (
        <Card className="border-blue-200 bg-blue-50/60">
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Rocket className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-base font-semibold text-blue-900">Sua operação começa aqui</h2>
                <p className="mt-0.5 text-sm text-blue-800/80">
                  Adicione sua equipe, crie um projeto e organize as primeiras tarefas.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/app/colaboradores" className={primaryLink}>
                <Users className="h-4 w-4" aria-hidden /> Adicionar colaboradores
              </Link>
              <Link href="/app/projetos" className={outlineLink}>
                <FolderKanban className="h-4 w-4" aria-hidden /> Criar projeto
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo executivo */}
      {kpis ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Colaboradores ativos"
            value={String(kpis.members)}
            hint={
              kpis.newMembersThisMonth > 0
                ? `+${kpis.newMembersThisMonth} este mês`
                : "Sem novos este mês"
            }
            href="/app/colaboradores"
            icon={Users}
            iconClass="text-blue-600"
          />
          <KpiCard
            label="Projetos em andamento"
            value={String(kpis.projectsActive)}
            hint={
              kpis.projectsOverdue > 0
                ? `${kpis.projectsOverdue} atrasado${kpis.projectsOverdue > 1 ? "s" : ""}`
                : "Nenhum atrasado"
            }
            href="/app/projetos"
            icon={FolderKanban}
            iconClass="text-violet-600"
          />
          <KpiCard
            label="Tarefas pendentes"
            value={String(kpis.tasksPending)}
            hint={
              kpis.tasksOverdue > 0
                ? `${kpis.tasksOverdue} atrasada${kpis.tasksOverdue > 1 ? "s" : ""}`
                : "Tudo em dia"
            }
            href="/app/tarefas"
            icon={ListTodo}
            iconClass="text-amber-600"
          />
          <KpiCard
            label="Taxa de conclusão"
            value={kpis.tasksRate != null ? `${kpis.tasksRate}%` : "—"}
            hint={
              kpis.tasksRate != null
                ? `${kpis.tasksDone} de ${kpis.tasksTotal} concluídas`
                : "Sem comparação disponível"
            }
            href="/app/indicadores"
            icon={CheckCircle2}
            iconClass="text-emerald-600"
          />
        </div>
      ) : (
        <SectionError message="Não foi possível carregar o resumo executivo." />
      )}

      {/* Atenção necessária */}
      {hasAttention && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <TrendingUp className="h-4 w-4" aria-hidden /> Atenção:
          </span>
          {kpis!.tasksOverdue > 0 && (
            <Link
              href="/app/tarefas"
              className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 transition hover:bg-red-200"
            >
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {kpis!.tasksOverdue} tarefa{kpis!.tasksOverdue > 1 ? "s" : ""} atrasada
              {kpis!.tasksOverdue > 1 ? "s" : ""}
            </Link>
          )}
          {kpis!.projectsOverdue > 0 && (
            <Link
              href="/app/projetos"
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-200"
            >
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {kpis!.projectsOverdue} projeto{kpis!.projectsOverdue > 1 ? "s" : ""} atrasado
              {kpis!.projectsOverdue > 1 ? "s" : ""}
            </Link>
          )}
          {kpis!.goalsAtRisk > 0 && (
            <Link
              href="/app/metas"
              className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700 transition hover:bg-orange-200"
            >
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {kpis!.goalsAtRisk} meta{kpis!.goalsAtRisk > 1 ? "s" : ""} em risco
            </Link>
          )}
        </div>
      )}

      {/* Performance / evolução */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              Evolução de tarefas: criadas × concluídas
            </CardTitle>
            <CardDescription>Tarefas por período selecionado.</CardDescription>
          </div>
          <div className="flex rounded-lg border bg-muted/40 p-0.5" role="group" aria-label="Período">
            {DASHBOARD_PERIODS.map((p) => (
              <Link
                key={p.value}
                href={`/dashboard?period=${p.value}`}
                aria-current={period === p.value ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition",
                  period === p.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {flow && flow.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              <FlowLineChart points={flow} />
              <div>
                <h3 className="mb-3 text-sm font-semibold">Distribuição por status</h3>
                {statusDist ? (
                  <StatusBars rows={statusDist} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Não foi possível carregar a distribuição.
                  </p>
                )}
              </div>
            </div>
          ) : flow === null ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Não foi possível carregar a evolução.{" "}
              <Link href="/dashboard" className="font-medium text-blue-600 hover:underline">
                Tentar novamente
              </Link>
            </p>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sem tarefas no período selecionado.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Tarefas + Projetos */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListTodo className="h-4 w-4 text-blue-600" aria-hidden />
                {memberMode ? "Minhas tarefas" : "Tarefas que precisam de atenção"}
              </CardTitle>
              <Link
                href="/app/tarefas"
                className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
              >
                Ver todas <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </CardHeader>
            <CardContent className="pt-2">
              {priorityTasks === null ? (
                <SectionError message="Não foi possível carregar as tarefas." />
              ) : priorityTasks.length === 0 ? (
                <EmptyState
                  title={memberMode ? "Nenhuma tarefa atribuída a você." : "Nenhuma tarefa pendente."}
                  description={
                    memberMode
                      ? "Quando alguém atribuir uma tarefa a você, ela aparecerá aqui."
                      : "Crie sua primeira tarefa para começar a acompanhar a operação."
                  }
                  action={
                    canWriteTasks ? (
                      <Link href="/app/tarefas?criar=1" className={primaryLink}>
                        <Plus className="h-4 w-4" aria-hidden /> Nova tarefa
                      </Link>
                    ) : undefined
                  }
                  className="py-8"
                />
              ) : (
                <ul className="divide-y">
                  {priorityTasks.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/app/tarefas?abrir=${t.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 px-2 py-3 transition hover:bg-accent"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{t.title}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {t.projectName ?? "Sem projeto"}
                            {t.assigneeName ? ` · ${t.assigneeName}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={PRIORITY_VARIANT[t.priority] ?? "default"}>
                            {PRIORITY_LABEL[t.priority] ?? t.priority}
                          </Badge>
                          <span
                            className={
                              t.overdue
                                ? "text-xs font-semibold text-red-600"
                                : "text-xs text-muted-foreground"
                            }
                          >
                            {t.dueDate
                              ? t.overdue
                                ? `Atrasada · ${formatDate(t.dueDate)}`
                                : formatDate(t.dueDate)
                              : "Sem prazo"}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderKanban className="h-4 w-4 text-blue-600" aria-hidden />
                Projetos em andamento
              </CardTitle>
              <Link
                href="/app/projetos"
                className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
              >
                Ver todos <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </CardHeader>
            <CardContent className="pt-2">
              {activeProjects === null ? (
                <SectionError message="Não foi possível carregar os projetos." />
              ) : activeProjects.length === 0 ? (
                <EmptyState
                  title="Nenhum projeto em andamento"
                  description="Crie seu primeiro projeto para começar a acompanhar sua operação."
                  action={
                    canWriteProjects ? (
                      <Link href="/app/projetos" className={primaryLink}>
                        <FolderKanban className="h-4 w-4" aria-hidden /> Criar projeto
                      </Link>
                    ) : undefined
                  }
                  className="py-8"
                />
              ) : (
                <ul className="divide-y">
                  {activeProjects.map((p) => (
                    <li key={p.id} className="px-2 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {(p.teamName ?? "Sem equipe")
                              .concat(p.responsibleName ? ` · ${p.responsibleName}` : "")}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-xs",
                            p.isOverdue ? "font-semibold text-red-600" : "text-muted-foreground"
                          )}
                        >
                          {daysLeft(p.dueDate)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              p.isOverdue ? "bg-red-500" : "bg-blue-600"
                            )}
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">
                          {p.progress}%
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Atividades + Agenda */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileBarChart2 className="h-4 w-4 text-blue-600" aria-hidden />
                Atividade recente
              </CardTitle>
              <Link
                href="/app/atividade"
                className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
              >
                Ver todas <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </CardHeader>
            <CardContent className="pt-2">
              {activity === null ? (
                <SectionError message="Não foi possível carregar as atividades." />
              ) : activity.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Ainda não há atividades registradas.
                </p>
              ) : (
                <ul className="space-y-3">
                  {activity.map((log) => (
                    <li key={log.id} className="flex items-start gap-3">
                      <Avatar name={log.userName ?? "?"} className="h-7 w-7 text-[10px]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          <span className="font-medium">{log.userName ?? "Sistema"}</span>{" "}
                          <span className="text-muted-foreground">
                            {activityLabel[log.action] ?? log.action}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelative(log.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-blue-600" aria-hidden />
                Próximos eventos
              </CardTitle>
              <Link
                href="/app/agenda"
                className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
              >
                Agenda <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </CardHeader>
            <CardContent className="pt-2">
              {events === null ? (
                <SectionError message="Não foi possível carregar os eventos." />
              ) : events.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum evento próximo.
                </p>
              ) : (
                <ul className="space-y-3">
                  {events.map((e, i) => {
                    const label = dayLabel(e.startsAt);
                    const showLabel = i === 0 || label !== dayLabel(events[i - 1].startsAt);
                    return (
                      <li key={e.id} className="flex items-start gap-3">
                        <span className="mt-0.5 w-14 shrink-0 text-xs font-semibold text-blue-600">
                          {new Date(e.startsAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <div className="min-w-0 flex-1">
                          {showLabel && (
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {label}
                            </p>
                          )}
                          <p className="truncate text-sm">{e.title}</p>
                          {e.projectName && (
                            <p className="truncate text-xs text-muted-foreground">{e.projectName}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}