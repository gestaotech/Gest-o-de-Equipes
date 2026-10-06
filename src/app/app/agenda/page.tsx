import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAppShellData } from "@/server/page-data";
import { prisma } from "@/lib/prisma";
import { permits } from "@/lib/rbac";
import {
  eventVisibilityWhere,
  getPageDataScope,
  projectVisibilityWhere,
  teamVisibilityWhere,
} from "@/server/scope";
import { AppShell } from "@/components/app-shell/app-shell";
import { AgendaClient } from "./client";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage() {
  const app = await getAppShellData();

  // Data Scope (modelo atual, sem EventParticipant):
  // MEMBER vê evento pessoal, da sua equipe, de projeto/tarefa permitidos.
  const scope = await getPageDataScope(redirect);

  const [events, teams, projects] = await Promise.all([
    prisma.event.findMany({
      where: eventVisibilityWhere(scope),
      include: {
        project: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { startsAt: "asc" },
      take: 120,
    }),
    prisma.team.findMany({
      where: { ...teamVisibilityWhere(scope), archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      where: projectVisibilityWhere(scope),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <AgendaClient
        events={events.map((e) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          type: e.type,
          allDay: e.allDay,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          projectId: e.projectId,
          projectName: e.project?.name ?? null,
          teamId: e.teamId,
          teamName: e.team?.name ?? null,
          user: e.user ? { id: e.user.id, name: e.user.name } : null,
        }))}
        teams={teams}
        projects={projects}
        canWrite={permits(app.org.role, "agenda.write")}
      />
    </AppShell>
  );
}