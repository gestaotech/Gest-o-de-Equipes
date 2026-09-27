import Link from "next/link";
import type { Metadata } from "next";
import type { ComponentType } from "react";
import {
  ListTodo,
  FolderKanban,
  Target,
  Users,
  CalendarClock,
  FileBarChart2,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { AppShell } from "@/components/app-shell/app-shell";
import { activityLabel } from "@/lib/activity-labels";
import { ROLE_LABEL } from "@/lib/rbac";
import { formatDate, formatRelative, isPastDue, cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { getAppShellData } from "@/server/page-data";
import {
  TaskStatus,
  ProjectStatus,
  GoalStatus,
  MemberStatus,
} from "@prisma/client";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function DashboardPage() {
  const app = await getAppShellData();

  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );
  const todayEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
  );

  const [
    openTasks,
    inProgressProjects,
    activeGoals,
    activeMembers,
    upcoming,
    todayEvents,
    activity,
  ] = await Promise.all([
    prisma.task.count({
      where: { organizationId: app.org.id, status: { not: TaskStatus.DONE } },
    }),
    prisma.project.count({
      where: { organizationId: app.org.id, status: ProjectStatus.EM_ANDAMENTO },
    }),
    prisma.goal.count({
      where: { organizationId: app.org.id, status: GoalStatus.EM_ANDAMENTO },
    }),
    prisma.organizationMember.count({
      where: { organizationId: app.org.id, status: MemberStatus.ATIVO },
    }),
    prisma.task.findMany({
      where: { organizationId: app.org.id, status: { not: TaskStatus.DONE } },
      include: {
        project: { select: { id: true, name: true } },
        assignees: {
          include: { member: { include: { user: { select: { name: true } } } } },
          take: 1,
        },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: 6,
    }),
    prisma.event.findMany({
      where: { organizationId: app.org.id, startsAt: { gte: todayStart, lte: todayEnd } },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { startsAt: "asc" },
      take: 6,
    }),
    prisma.activityLog.findMany({
      where: { organizationId: app.org.id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const kpis: Array<{
    label: string;
    value: number;
    icon: ComponentType<{ className?: string }>;
    href: string;
    tone: string;
  }> = [
    {
      label: "Tarefas pendentes",
      value: openTasks,
      icon: ListTodo,
      href: "/app/tarefas",
      tone: "text-blue-600",
    },
    {
      label: "Projetos em andamento",
      value: inProgressProjects,
      icon: FolderKanban,
      href: "/app/projetos",
      tone: "text-violet-600",
    },
    {
      label: "Metas ativas",
      value: activeGoals,
      icon: Target,
      href: "/app/metas",
      tone: "text-emerald-600",
    },
    {
      label: "Colaboradores ativos",
      value: activeMembers,
      icon: Users,
      href: "/app/colaboradores",
      tone: "text-amber-600",
    },
  ];

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <div className="space-y-4 p-4 lg:p-6">
        <div>
          <h1 className="text-xl font-bold">
            {greeting()}, {app.user.name.split(" ")[0]}!
          </h1>
          <p className="text-sm text-muted-foreground">
            {app.org.name} ·{" "}
            {ROLE_LABEL[app.org.role] ?? app.org.role}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((k) => (
            <Link key={k.label} href={k.href} className="group">
              <Card className="transition hover:border-primary/40">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
                    <p className="mt-1 text-2xl font-bold">{k.value}</p>
                  </div>
                  <k.icon className={cn("h-6 w-6", k.tone)} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">Próximas tarefas</CardTitle>
                <Link
                  href="/app/tarefas"
                  className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                >
                  Ver todas <ChevronRight className="h-4 w-4" />
                </Link>
              </CardHeader>
              <CardContent className="p-5">
                {upcoming.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nenhuma tarefa pendente.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {upcoming.map((t) => (
                      <li key={t.id}>
                        <Link
                          href={`/app/tarefas?abrir=${t.id}`}
                          className="flex items-start justify-between gap-3 rounded-lg p-2 transition hover:bg-accent"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{t.title}</p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {t.project?.name ?? "Sem projeto"}
                              {t.assignees[0] ? ` · ${t.assignees[0].member.user.name}` : ""}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 text-xs",
                              t.dueDate && isPastDue(t.dueDate)
                                ? "font-semibold text-red-600"
                                : "text-muted-foreground"
                            )}
                          >
                            {t.dueDate
                              ? isPastDue(t.dueDate)
                                ? `Atrasada · ${formatDate(t.dueDate)}`
                                : formatDate(t.dueDate)
                              : "Sem prazo"}
                          </span>
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
                  <FileBarChart2 className="h-4 w-4 text-blue-600" />
                  Atividade recente
                </CardTitle>
                <Link
                  href="/app/atividade"
                  className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                >
                  Ver todas <ChevronRight className="h-4 w-4" />
                </Link>
              </CardHeader>
              <CardContent className="p-5">
                {activity.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Ainda não há atividades registradas.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {activity.map((log) => (
                      <li key={log.id} className="flex items-start gap-3">
                        <Avatar name={log.user?.name ?? "?"} className="h-7 w-7 text-[10px]" />
                        <div className="min-w-0 flex-1 text-sm">
                          <p>
                            <span className="font-medium">{log.user?.name ?? "Sistema"}</span>{" "}
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
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-blue-600" />
                Hoje
              </CardTitle>
              <Link
                href="/app/agenda"
                className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
              >
                Agenda <ChevronRight className="h-4 w-4" />
              </Link>
            </CardHeader>
            <CardContent className="p-5">
              {todayEvents.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum evento agendado para hoje.
                </p>
              ) : (
                <ul className="space-y-3">
                  {todayEvents.map((e) => (
                    <li key={e.id} className="rounded-lg p-2 transition hover:bg-accent">
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(e.startsAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {e.project?.name ? ` · ${e.project.name}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}