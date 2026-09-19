import type { Metadata } from "next";
import Link from "next/link";
import {
  Users,
  ListTodo,
  FolderKanban,
  Target,
  CalendarClock,
  AlertTriangle,
  Plus,
  ArrowRight,
} from "lucide-react";
import { getAppShellData } from "@/server/page-data";
import {
  getOrgStats,
  getUpcomingTasks,
  getUpcomingEvents,
  getRecentActivity,
  activityLabel,
} from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, statusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  formatDate,
  formatRelative,
  formatDateTime,
} from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const app = await getAppShellData();
  const org = app.org;
  const stats = await getOrgStats(org.id);
  const [myTasks, events, activity, announcements] = await Promise.all([
    getUpcomingTasks(org.id, app.membershipId, 6),
    getUpcomingEvents(org.id, 5),
    getRecentActivity(org.id, 8),
    prisma.announcement.findMany({
      where: { organizationId: org.id },
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 2,
    }),
  ]);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <AppShell
      org={app.org}
      orgs={app.orgs}
      user={app.user}
      unread={app.unread}
    >
      <div className="space-y-6">
        <PageHeader
          title={`${greeting}, ${app.user.name.split(" ")[0]}`}
          description={`Visão geral de ${app.org.name}.`}
          actions={
            <Link
              href="/app/tarefas?criar=1"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> Nova tarefa
            </Link>
          }
        />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard icon={Users} label="Colaboradores" value={stats.members} href="/app/colaboradores" />
          <StatCard icon={ListTodo} label="Tarefas em aberto" value={stats.tasks.total - stats.tasks.done} href="/app/tarefas" />
          <StatCard icon={AlertTriangle} label="Em atraso" value={stats.lateTasks} href="/app/tarefas?status=atrasadas" danger />
          <StatCard icon={FolderKanban} label="Projetos ativos" value={stats.projects.active} href="/app/projetos" />
          <StatCard icon={Target} label="Metas" value={stats.goals} href="/app/metas" />
          <StatCard icon={CalendarClock} label="Próximos eventos" value={stats.events} href="/app/agenda" />
        </div>

        {stats.lateTasks > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Você tem <strong>{stats.lateTasks}</strong>{" "}
              {stats.lateTasks === 1 ? "tarefa atrasada" : "tarefas atrasadas"}.{" "}
              <Link href="/app/tarefas?status=atrasadas" className="font-medium underline">
                Revisar agora
              </Link>
            </span>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">Minhas próximas tarefas</h3>
                <Link href="/app/tarefas" className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
                  Ver todas <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {myTasks.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma tarefa atribuída a você. <Link href="/app/tarefas?criar=1" className="text-blue-600 hover:underline">Criar uma</Link>
                </p>
              ) : (
                <ul className="divide-y">
                  {myTasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/app/tarefas?abrir=${t.id}`} className="font-medium hover:text-blue-600">
                          {t.title}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {t.project && <span className="truncate">📁 {t.project.name}</span>}
                          {t.dueDate && (
                            <span className={isOverdue(t.dueDate) ? "font-medium text-red-600" : ""}>
                              Prazo: {formatDate(t.dueDate)}
                            </span>
                          )}
                        </div>
                      </div>
                      {statusBadge(t.status)}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">Próximos eventos</h3>
                <Link href="/app/agenda" className="text-sm font-medium text-blue-600 hover:underline">
                  Agenda
                </Link>
              </div>
              {events.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sem eventos futuros.</p>
              ) : (
                <ul className="divide-y">
                  {events.map((e) => (
                    <li key={e.id} className="flex items-start gap-3 py-2.5">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                        <span className="text-xs font-bold leading-none">
                          {new Date(e.startsAt).getDate()}
                        </span>
                        <span className="text-[9px] uppercase leading-tight">
                          {monthShort(e.startsAt)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{e.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(e.startsAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="p-5">
              <h3 className="mb-3 font-semibold">Atividade recente</h3>
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
                        <p className="text-foreground">
                          <span className="font-medium">{log.user?.name ?? "Sistema"}</span>{" "}
                          <span className="text-muted-foreground">
                            {activityLabel[log.action] ?? log.action}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">{formatRelative(log.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">Avisos</h3>
                <Link href="/app/avisos" className="text-sm font-medium text-blue-600 hover:underline">
                  Ver todos
                </Link>
              </div>
              {announcements.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum aviso publicado ainda.
                </p>
              ) : (
                <ul className="space-y-3">
                  {announcements.map((a) => (
                    <li key={a.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{a.title}</p>
                        <Badge variant="secondary">{formatDate(a.createdAt)}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.message}</p>
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

function StatCard({
  icon: Icon,
  label,
  value,
  href,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  href: string;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="truncate text-xs font-medium">{label}</span>
      </div>
      <p className={danger ? "mt-2 text-2xl font-bold text-red-600" : "mt-2 text-2xl font-bold"}>
        {value}
      </p>
    </Link>
  );
}

function isOverdue(d: Date): boolean {
  return d.getTime() < Date.now();
}

function monthShort(value: string | Date) {
  return new Date(value)
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "");
}

export const dynamic = "force-dynamic";