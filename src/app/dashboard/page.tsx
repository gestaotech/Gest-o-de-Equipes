import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { getAppShellData } from "@/server/page-data";
import { getPageDataScope } from "@/server/scope";
import { ROLE_LABEL, permits } from "@/lib/rbac";
import { periodRange } from "@/lib/indicator-metrics";
import {
  getStatusDistribution,
  getTaskFlowEvolution,
  type EvolutionGranularity,
  type IndicatorScope,
} from "@/lib/indicator-queries";
import { ReportPeriod } from "@/lib/indicator-metrics";
import {
  getActiveProjects,
  getDashboardKpis,
  getPriorityTasks,
  getRecentActivity,
  getUpcomingEvents,
} from "@/server/dashboard-data";
import { DashboardView } from "./view";

export const metadata: Metadata = { title: "Dashboard" };

const PERIOD_OPTIONS = new Set(["7d", "30d", "90d", "month"]);

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const app = await getAppShellData();

  const sp = await searchParams;
  const raw = Array.isArray(sp.period) ? sp.period[0] : sp.period;
  const period: ReportPeriod = raw && PERIOD_OPTIONS.has(raw) ? (raw as ReportPeriod) : "30d" as ReportPeriod;

  const range = periodRange(period, undefined, undefined);
  const span = range?.from ? Date.now() - range.from.getTime() : null;
  const granularity: EvolutionGranularity = span == null ? "week" : span <= 32 * 86400000 ? "day" : span <= 190 * 86400000 ? "week" : "month";

  const memberMode = app.org.role === "MEMBER";

  // Data Scope: TODOS os blocos abaixo respeitam o escopo do perfil.
  // Antes passavam apenas orgId e o MEMBER via a organização inteira.
  const scope = await getPageDataScope(redirect);
  const indicatorScope: IndicatorScope = { orgId: scope.orgId, period, restrict: scope };

  const [kpis, priorityTasks, activeProjects, events, activity, flow, statusDist] =
    await Promise.all([
      getDashboardKpis(scope).catch(() => null),
      getPriorityTasks(scope).catch(() => null),
      getActiveProjects(scope).catch(() => null),
      getUpcomingEvents(scope).catch(() => null),
      getRecentActivity(scope).catch(() => null),
      getTaskFlowEvolution(indicatorScope, granularity, range).catch(() => null),
      getStatusDistribution(indicatorScope, range).catch(() => null),
    ]);

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <DashboardView
        userName={app.user.name}
        orgName={app.org.name}
        roleLabel={ROLE_LABEL[app.org.role] ?? app.org.role}
        period={period}
        kpis={kpis}
        priorityTasks={priorityTasks}
        memberMode={memberMode}
        activeProjects={activeProjects}
        events={events}
        activity={activity}
        flow={flow}
        statusDist={statusDist}
        canWriteTasks={permits(app.org.role, "tasks.write")}
        canWriteProjects={permits(app.org.role, "projects.write")}
      />
    </AppShell>
  );
}