"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PERIOD_OPTIONS, type ReportPeriod } from "@/lib/indicator-metrics";

export type ScopeFiltersState = {
  period: string;
  from?: string;
  to?: string;
  teamId?: string;
  departmentId?: string;
  memberId?: string;
  projectId?: string;
  status?: string;
  priority?: string;
};

export type FilterOption = { id: string; name: string };

export function ScopeFilters({
  basePath,
  filters,
  teams,
  departments,
  members,
  projects,
}: {
  basePath: string;
  filters: ScopeFiltersState;
  teams: FilterOption[];
  departments: FilterOption[];
  members: FilterOption[];
  projects: FilterOption[];
}) {
  const router = useRouter();

  function apply(patch: Partial<ScopeFiltersState>) {
    const next: Record<string, string> = {};
    const merged = { ...filters, ...patch };
    if (merged.period) next.period = merged.period;
    if (merged.period === "custom" && merged.from) next.from = merged.from;
    if (merged.period === "custom" && merged.to) next.to = merged.to;
    if (merged.teamId) next.teamId = merged.teamId;
    if (merged.departmentId) next.departmentId = merged.departmentId;
    if (merged.memberId) next.memberId = merged.memberId;
    if (merged.projectId) next.projectId = merged.projectId;
    if (merged.status) next.status = merged.status;
    if (merged.priority) next.priority = merged.priority;
    const qs = new URLSearchParams(next).toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  const selectCls =
    "flex h-9 items-center rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const filterSelects: Array<{
    key: "departmentId" | "teamId" | "memberId" | "projectId";
    options: FilterOption[];
    label: string;
  }> = [
    { key: "departmentId", options: departments, label: "Departamento" },
    { key: "teamId", options: teams, label: "Equipe" },
    { key: "memberId", options: members, label: "Colaborador" },
    { key: "projectId", options: projects, label: "Projeto" },
  ];

  return (
    <Card className="mb-4">
      <CardContent className="flex flex-wrap items-end gap-2 pt-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Período
          <select
            className={selectCls}
            value={filters.period}
            onChange={(e) => apply({ period: e.target.value as ReportPeriod })}
          >
            {PERIOD_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {filters.period === "custom" && (
          <>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              De
              <input
                type="date"
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
                value={filters.from ?? ""}
                onChange={(e) => apply({ from: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Até
              <input
                type="date"
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
                value={filters.to ?? ""}
                onChange={(e) => apply({ to: e.target.value })}
              />
            </label>
          </>
        )}
        {filterSelects.map(({ key, options, label }) => (
          <label key={key} className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {label}
            <select
              className={selectCls}
              value={filters[key] ?? ""}
              onChange={(e) =>
                apply({ [key]: e.target.value || undefined })
              }
            >
              <option value="">Todos</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Status
          <select
            className={selectCls}
            value={filters.status ?? ""}
            onChange={(e) => apply({ status: e.target.value || undefined })}
          >
            <option value="">Todos</option>
            {["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].map((s) => (
              <option key={s} value={s}>
                {s === "DONE" ? "Concluída" : s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Prioridade
          <select
            className={selectCls}
            value={filters.priority ?? ""}
            onChange={(e) => apply({ priority: e.target.value || undefined })}
          >
            <option value="">Todas</option>
            {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
              <option key={p} value={p}>
                {p === "LOW" ? "Baixa" : p === "MEDIUM" ? "Média" : p === "HIGH" ? "Alta" : "Urgente"}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-medium text-muted-foreground hover:bg-accent"
          onClick={() => router.push(basePath)}
        >
          Limpar
        </button>
      </CardContent>
    </Card>
  );
}