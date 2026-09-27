import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell/app-shell";
import { getAppShellData } from "@/server/page-data";
import { ROLE_LABEL } from "@/lib/rbac";
import { periodRange } from "@/lib/indicator-metrics";
import {
  getStatusDistribution,
  getTaskFlowEvolution,
  type EvolutionGranularity,
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
  const scope = { orgId: app.org.id, period };

  const [kpis, priorityTasks, activeProjects, events, activity, flow, statusDist] =
    await Promise.all([
      getDashboardKpis(app.org.id).catch(() => null),
      getPriorityTasks(app.org.id, memberMode ? app.membershipId : null).catch(() => null),
      getActiveProjects(app.org.id).catch(() => null),
      getUpcomingEvents(app.org.id).catch(() => null),
      getRecentActivity(app.org.id).catch(() => null),
      getTaskFlowEvolution(scope, granularity, range).catch(() => null),
      getStatusDistribution(scope, range).catch(() => null),
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
        canWriteTasks={app.org.role === "OWNER" || app.org.role === "ADMIN" || app.org.role === "MANAGER" || app.org.role === "LEADER"}
        canWriteProjects={app.org.role === "OWNER" || app.org.role === "ADMIN" || app.org.role === "MANAGER"}
      />
    </AppShell>
  );
}