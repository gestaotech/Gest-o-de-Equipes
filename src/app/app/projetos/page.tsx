import type { Metadata } from "next";
import { getAppShellData } from "@/server/page-data";
import { prisma } from "@/lib/prisma";
import { permits } from "@/lib/rbac";
import { AppShell } from "@/components/app-shell/app-shell";
import { ProjectsClient } from "./client";

export const metadata: Metadata = { title: "Projetos" };

export default async function ProjetosPage() {
  const app = await getAppShellData();
  const [projects, teams, members] = await Promise.all([
    prisma.project.findMany({
      where: { organizationId: app.org.id },
      include: {
        responsible: { include: { user: { select: { name: true } } } },
        team: { select: { id: true, name: true } },
        members: {
          include: { member: { include: { user: { select: { name: true } } } } },
        },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.team.findMany({
      where: { organizationId: app.org.id, archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: app.org.id },
      select: { id: true, user: { select: { name: true } } },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <ProjectsClient
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          status: p.status,
          priority: p.priority,
          startDate: p.startDate,
          dueDate: p.dueDate,
          teamId: p.teamId,
          teamName: p.team?.name ?? null,
          responsibleId: p.responsibleId,
          responsibleName: p.responsible?.user?.name ?? null,
          memberIds: p.members.map((m) => m.memberId),
          memberNames: p.members.map((m) => m.member.user.name),
          tasks: p._count.tasks,
        }))}
        teams={teams}
        members={members}
        canWrite={permits(app.org.role, "projects.write")}
        canDelete={permits(app.org.role, "projects.delete")}
      />
    </AppShell>
  );
}