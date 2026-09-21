"use client";

import * as React from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderKanban,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { statusBadge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EvolutionChart, type EvolutionPoint } from "@/components/charts/evolution-chart";
import { ScopeFilters, type FilterOption } from "@/components/reports/scope-filters";
import type {
  DistributionRow,
  GoalRow,
  MemberRow,
  OrgSummary,
  ProjectRow,
  TeamRow,
} from "@/lib/indicator-queries";
import type { IndicatorFilters } from "./page";

type Props = {
  filters: IndicatorFilters;
  summary: OrgSummary;
  statusDist: DistributionRow[];
  priorityDist: DistributionRow[];
  evolution: EvolutionPoint[];
  teamBoard: TeamRow[];
  memberBoard: MemberRow[];
  projectBoard: ProjectRow[];
  goals: GoalRow[];
  teams: FilterOption[];
  departments: FilterOption[];
  members: FilterOption[];
  projects: FilterOption[];
};

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "destructive";
}) {
  const tones = {
    default: "text-blue-600",
    success: "text-emerald-600",
    warning: "text-amber-600",
    destructive: "text-red-600",
  } as const;
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardDescription className="flex items-center gap-1.5">
          <span className={tones[tone]}>{icon}</span>
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className={tones[tone]} style={{ fontSize: "1.6rem", fontWeight: 700, lineHeight: 1.1 }}>
          {value}
        </div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function DistributionBars({ rows, labelOf }: { rows: DistributionRow[]; labelOf: (k: string) => string }) {
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">{labelOf(r.key)}</span>
            <span className="text-muted-foreground">
              {r.count}
              {r.percent != null ? ` · ${r.percent}%` : ""}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${r.percent ?? 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: "Backlog",
  TODO: "A fazer",
  IN_PROGRESS: "Em andamento",
  IN_REVIEW: "Em revisão",
  DONE: "Concluída",
};
const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export function IndicadoresView({
  filters,
  summary,
  statusDist,
  priorityDist,
  evolution,
  teamBoard,
  memberBoard,
  projectBoard,
  goals,
  teams,
  departments,
  members,
  projects,
}: Props) {
  const { tasks, projects: pj, goals: g } = summary;
  const empty = tasks.total === 0 && pj.active === 0 && g.total === 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
      <PageHeader
        title="Indicadores"
        description="Acompanhamento de equipes e resultados com dados reais."
      />

      <ScopeFilters
        basePath="/app/indicadores"
        filters={filters}
        teams={teams}
        departments={departments}
        members={members}
        projects={projects}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Tarefas (período)"
          value={String(tasks.total)}
          hint={`${tasks.done} concluídas`}
        />
        <KpiCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Taxa de conclusão"
          value={tasks.rate != null ? `${tasks.rate}%` : "—"}
          hint={tasks.rate == null ? "Sem dados no período" : `de ${tasks.total} tarefas`}
          tone={tasks.rate != null && tasks.rate >= 70 ? "success" : "default"}
        />
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label="Pendentes"
          value={String(tasks.pending)}
          hint={`${tasks.overdue} atrasadas`}
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Atrasadas"
          value={String(tasks.overdue)}
          tone={tasks.overdue > 0 ? "destructive" : "success"}
          hint="com prazo vencido"
        />
        <KpiCard
          icon={<FolderKanban className="h-4 w-4" />}
          label="Projetos ativos"
          value={String(pj.active)}
          hint={`${pj.concluded} concluídos · ${pj.overdue} atrasados`}
          tone={pj.overdue > 0 ? "warning" : "default"}
        />
        <KpiCard
          icon={<Target className="h-4 w-4" />}
          label="Metas em risco"
          value={String(g.atRisk)}
          hint={`${g.inProgress} em andamento`}
          tone={g.atRisk > 0 ? "destructive" : "success"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tarefas concluídas ao longo do tempo</CardTitle>
          <CardDescription>Evolução por período selecionado.</CardDescription>
        </CardHeader>
        <CardContent>
          <EvolutionChart points={evolution} color={empty ? "#e2e8f0" : "#2563EB"} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por status</CardTitle>
          </CardHeader>
          <CardContent>
            <DistributionBars rows={statusDist} labelOf={(k) => STATUS_LABELS[k] ?? k} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <DistributionBars rows={priorityDist} labelOf={(k) => PRIORITY_LABELS[k] ?? k} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Resultado por equipe</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipe</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Concluídas</TableHead>
                  <TableHead className="text-right">Atrasadas</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamBoard.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-right">{t.total}</TableCell>
                    <TableCell className="text-right">{t.done}</TableCell>
                    <TableCell className="text-right text-red-600">{t.overdue}</TableCell>
                    <TableCell className="text-right">{t.rate != null ? `${t.rate}%` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultado por colaborador</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Concluídas</TableHead>
                  <TableHead className="text-right">Atrasadas</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberBoard.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.department ?? "—"}</TableCell>
                    <TableCell className="text-right">{m.total}</TableCell>
                    <TableCell className="text-right">{m.done}</TableCell>
                    <TableCell className="text-right text-red-600">{m.overdue}</TableCell>
                    <TableCell className="text-right">{m.rate != null ? `${m.rate}%` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultado por projeto</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Progresso</TableHead>
                  <TableHead className="text-right">Tarefas</TableHead>
                  <TableHead className="text-right">Atrasadas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectBoard.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {p.name}
                        {p.isOverdue && <AlertTriangle className="h-4 w-4 text-red-600" />}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.responsibleName ?? "—"}</TableCell>
                    <TableCell>{statusBadge(p.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="ml-auto flex w-28 items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-blue-600" style={{ width: `${p.progress}%` }} />
                        </div>
                        <span className="text-xs">{p.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{p.total}</TableCell>
                    <TableCell className="text-right text-red-600">{p.overdue}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metas</CardTitle>
            <CardDescription>Regra de risco: em andamento, prazo até 14 dias e progresso abaixo de 80%.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meta</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Progresso</TableHead>
                  <TableHead className="text-right">Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {goals.map((go) => (
                  <TableRow key={go.id}>
                    <TableCell className="font-medium">{go.title}</TableCell>
                    <TableCell className="text-muted-foreground">{go.responsibleName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{go.teamName ?? "—"}</TableCell>
                    <TableCell>{statusBadge(go.status)}</TableCell>
                    <TableCell className="text-right">{go.progress}%</TableCell>
                    <TableCell className="text-right">
                      {go.atRisk ? (
                        <span className="inline-flex items-center gap-1 font-medium text-red-600">
                          <AlertTriangle className="h-4 w-4" /> Em risco
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Ok</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}