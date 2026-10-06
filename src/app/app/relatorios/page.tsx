import type { Metadata } from "next";
import * as React from "react";
import { redirect } from "next/navigation";
import { FileDown } from "lucide-react";
import { getAppShellData } from "@/server/page-data";
import { prisma } from "@/lib/prisma";
import { permits } from "@/lib/rbac";
import { getPageDataScope } from "@/server/scope";
import {
  departmentVisibilityWhere,
  indicatorScopeFor,
  projectVisibilityWhere,
  teamVisibilityWhere,
  visibleMembersWhere,
} from "@/server/scope/rules";
import { AppShell } from "@/components/app-shell/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { statusBadge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ReportTable } from "@/components/reports/report-table";
import { ScopeFilters } from "@/components/reports/scope-filters";
import { indicatorScopeSchema } from "@/lib/validations";
import { periodRange } from "@/lib/indicator-metrics";
import { REPORT_KINDS, reportRows, type ReportKind } from "@/lib/reports";
import type {
  GoalRow,
  IndicatorScope,
  MemberRow,
  ProjectRow,
  TeamRow,
} from "@/lib/indicator-queries";
import type { TaskReportRow } from "@/lib/reports";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Relatórios" };

const KINDS = REPORT_KINDS.map((k) => k.value) as ReportKind[];

function isKind(v: unknown): v is ReportKind {
  return typeof v === "string" && (KINDS as string[]).includes(v);
}

export default async function RelatoriosPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const app = await getAppShellData();
  if (!permits(app.org.role, "reports.read")) redirect("/dashboard");

  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const kind: ReportKind = isKind(one(sp.kind)) ? (one(sp.kind) as ReportKind) : "tasks";

  const parsed = indicatorScopeSchema.safeParse({
    period: one(sp.period),
    from: one(sp.from),
    to: one(sp.to),
    teamId: one(sp.teamId),
    departmentId: one(sp.departmentId),
    memberId: one(sp.memberId),
    projectId: one(sp.projectId),
    status: one(sp.status),
    priority: one(sp.priority),
  });
  const f = parsed.success ? parsed.data : {};
  const period = (f.period ?? "30d") as IndicatorScope["period"];
  const range = periodRange(period, f.from, f.to);

  // SCOPE: delimita as linhas visíveis. `memberId` do cliente é FORÇADO para o
  // próprio membro fora do escopo organizacional, evitando IDOR de relatório.
  const dataScope = await getPageDataScope(redirect);
  const scope: IndicatorScope = indicatorScopeFor(dataScope, {
    orgId: dataScope.orgId,
    period,
    ...f,
  });
  scope.restrict = dataScope;

  const rows = await reportRows(kind, scope, range);

  // Os filtros também respeitam o escopo, para não expor a estrutura da org.
  const [teams, departments, members, projects] = await Promise.all([
    prisma.team.findMany({
      where: { ...teamVisibilityWhere(dataScope), archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where: departmentVisibilityWhere(dataScope),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.organizationMember.findMany({
      where: visibleMembersWhere(dataScope),
      select: { id: true, user: { select: { name: true } } },
      orderBy: { joinedAt: "asc" },
    }).then((ms) => ms.map((m) => ({ id: m.id, name: m.user.name }))),
    prisma.project.findMany({
      where: projectVisibilityWhere(dataScope),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const filterQs = new URLSearchParams();
  if (f.from) filterQs.set("from", f.from);
  if (f.to) filterQs.set("to", f.to);
  if (f.period) filterQs.set("period", f.period);
  if (f.teamId) filterQs.set("teamId", f.teamId);
  if (f.departmentId) filterQs.set("departmentId", f.departmentId);
  if (f.memberId) filterQs.set("memberId", f.memberId);
  if (f.projectId) filterQs.set("projectId", f.projectId);
  if (f.status) filterQs.set("status", f.status);
  if (f.priority) filterQs.set("priority", f.priority);
  const exportQs = new URLSearchParams(filterQs);
  exportQs.set("kind", kind);

  const canExport = permits(app.org.role, "reports.export");

  const table = renderTable(kind, rows);

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6">
        <PageHeader
          title="Relatórios"
          description="Exportação e consulta de dados por período, equipe, colaborador e projeto."
          actions={
            canExport ? (
              <a
                href={`/app/relatorios/exportar?${exportQs.toString()}`}
                download
                className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                <FileDown className="h-4 w-4" />
                Exportar CSV
              </a>
            ) : undefined
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          {REPORT_KINDS.map((k) => {
            const active = k.value === kind;
            const href = `/app/relatorios?${new URLSearchParams({ ...Object.fromEntries(filterQs), kind: k.value }).toString()}`;
            return (
              <a
                key={k.value}
                href={href}
                title={k.description}
                className={`inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-600 text-white"
                    : "border border-input bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                {k.label}
              </a>
            );
          })}
        </div>

        <ScopeFilters
          basePath="/app/relatorios"
          filters={{ period, ...(f.from ? { from: f.from } : {}), ...(f.to ? { to: f.to } : {}), teamId: f.teamId, departmentId: f.departmentId, memberId: f.memberId, projectId: f.projectId, status: f.status, priority: f.priority }}
          teams={teams}
          departments={departments}
          members={members}
          projects={projects}
        />

        <Card>
          <CardContent className="p-0 pt-0">{table}</CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function renderTable(kind: ReportKind, raw: unknown): React.ReactNode {
  const empty =
    "Sem dados para os filtros escolhidos. Ajuste o período ou remova filtros.";

  switch (kind) {
    case "tasks": {
      const rows = raw as TaskReportRow[];
      return (
        <ReportTable
          headers={["Título", "Projeto", "Responsável", "Equipe", "Status", "Prioridade", "Prazo", "Concluída"]}
          rows={rows.map((r) => [
            <span key={r.title} className="font-medium">{r.title}</span>,
            r.project ?? "—",
            r.responsible ?? "—",
            r.team ?? "—",
            statusBadge(r.status),
            statusBadge(r.priority),
            formatDate(r.dueDate),
            formatDate(r.completedAt),
          ])}
          empty={empty}
        />
      );
    }
    case "projects": {
      const rows = raw as ProjectRow[];
      return (
        <ReportTable
          headers={["Nome", "Responsável", "Equipe", "Status", "Prioridade", "Prazo", "Tarefas", "Progresso", "Situação"]}
          rows={rows.map((r) => [
            <span key={r.name} className="font-medium">{r.name}</span>,
            r.responsibleName ?? "—",
            r.teamName ?? "—",
            statusBadge(r.status),
            statusBadge(r.priority),
            formatDate(r.dueDate),
            r.total,
            `${r.progress}%`,
            <span key={r.id} className={r.isOverdue ? "font-medium text-red-600" : "text-muted-foreground"}>
              {r.isOverdue ? "Atrasado" : "Em dia"}
            </span>,
          ])}
          empty={empty}
        />
      );
    }
    case "teams": {
      const rows = raw as TeamRow[];
      return (
        <ReportTable
          headers={["Equipe", "Total", "Concluídas", "Atrasadas", "Taxa"]}
          rows={rows.map((r) => [
            <span key={r.id} className="font-medium">{r.name}</span>,
            r.total,
            r.done,
            r.overdue,
            r.rate != null ? `${r.rate}%` : "—",
          ])}
          empty={empty}
        />
      );
    }
    case "members": {
      const rows = raw as MemberRow[];
      return (
        <ReportTable
          headers={["Nome", "Departamento", "Equipes", "Total", "Concluídas", "Atrasadas", "Taxa"]}
          rows={rows.map((r) => [
            <span key={r.id} className="font-medium">{r.name}</span>,
            r.department ?? "—",
            r.teamNames.join(", ") || "—",
            r.total,
            r.done,
            r.overdue,
            r.rate != null ? `${r.rate}%` : "—",
          ])}
          empty={empty}
        />
      );
    }
    case "goals": {
      const rows = raw as GoalRow[];
      return (
        <ReportTable
          headers={["Meta", "Responsável", "Equipe", "Status", "Progresso", "Situação"]}
          rows={rows.map((r) => [
            <span key={r.id} className="font-medium">{r.title}</span>,
            r.responsibleName ?? "—",
            r.teamName ?? "—",
            statusBadge(r.status),
            `${r.progress}%`,
            <span key={r.id} className={r.atRisk ? "font-medium text-red-600" : "text-muted-foreground"}>
              {r.atRisk ? "Em risco" : "Ok"}
            </span>,
          ])}
          empty={empty}
        />
      );
    }
  }
}