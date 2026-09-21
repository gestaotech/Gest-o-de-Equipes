import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAppShellData } from "@/server/page-data";
import { prisma } from "@/lib/prisma";
import { permits } from "@/lib/rbac";
import { AppShell } from "@/components/app-shell/app-shell";
import { indicatorScopeSchema } from "@/lib/validations";
import { periodRange } from "@/lib/indicator-metrics";
import {
  getOrgSummary,
  getStatusDistribution,
  getPriorityDistribution,
  getTaskEvolution,
  getTeamBoard,
  getMemberBoard,
  getProjectBoard,
  getGoalRows,
  type EvolutionGranularity,
  type IndicatorScope,
} from "@/lib/indicator-queries";
import { IndicadoresView } from "./view";

export const metadata: Metadata = { title: "Indicadores" };

export type IndicatorFilters = {
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

export default async function IndicadoresPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const app = await getAppShellData();
  if (!permits(app.org.role, "indicators.read")) redirect("/dashboard");

  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
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
  const scope: IndicatorScope = { orgId: app.org.id, period, ...f };

  const span = range?.from
    ? (range.to ?? new Date()).getTime() - range.from.getTime()
    : null;
  const granularity: EvolutionGranularity =
    span == null
      ? "week"
      : span <= 32 * 86400000
        ? "day"
        : span <= 190 * 86400000
          ? "week"
          : "month";

  const [
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
  ] = await Promise.all([
    getOrgSummary(scope, range),
    getStatusDistribution(scope, range),
    getPriorityDistribution(scope, range),
    getTaskEvolution(scope, granularity, range),
    getTeamBoard(scope, range),
    getMemberBoard(scope, range),
    getProjectBoard(scope, range),
    getGoalRows(scope),
    prisma.team.findMany({
      where: { organizationId: app.org.id, archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where: { organizationId: app.org.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: app.org.id },
      select: { id: true, user: { select: { name: true } } },
      orderBy: { joinedAt: "asc" },
    }).then((ms) => ms.map((m) => ({ id: m.id, name: m.user.name }))),
    prisma.project.findMany({
      where: { organizationId: app.org.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const filters: IndicatorFilters = {
    period,
    ...(f.from ? { from: f.from } : {}),
    ...(f.to ? { to: f.to } : {}),
    ...(f.teamId ? { teamId: f.teamId } : {}),
    ...(f.departmentId ? { departmentId: f.departmentId } : {}),
    ...(f.memberId ? { memberId: f.memberId } : {}),
    ...(f.projectId ? { projectId: f.projectId } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.priority ? { priority: f.priority } : {}),
  };

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <IndicadoresView
        filters={filters}
        summary={summary}
        statusDist={statusDist}
        priorityDist={priorityDist}
        evolution={evolution}
        teamBoard={teamBoard}
        memberBoard={memberBoard}
        projectBoard={projectBoard}
        goals={goals}
        teams={teams}
        departments={departments}
        members={members}
        projects={projects}
      />
    </AppShell>
  );
}