import type { Metadata } from "next";
import { getAppShellData } from "@/server/page-data";
import { prisma } from "@/lib/prisma";
import { permits } from "@/lib/rbac";
import { AppShell } from "@/components/app-shell/app-shell";
import { TeamsClient } from "./client";

export const metadata: Metadata = { title: "Equipes" };

export default async function EquipesPage() {
  const app = await getAppShellData();
  const [teams, departments, members] = await Promise.all([
    prisma.team.findMany({
      where: { organizationId: app.org.id, archivedAt: null },
      include: {
        lead: { include: { user: { select: { name: true } } } },
        members: {
          include: {
            member: {
              include: { user: { select: { id: true, name: true } } },
            },
          },
        },
        department: { select: { id: true, name: true } },
        _count: { select: { projects: true, tasks: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where: { organizationId: app.org.id, archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: app.org.id },
      select: {
        id: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <TeamsClient
        teams={teams.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          departmentId: t.departmentId,
          departmentName: t.department?.name ?? null,
          leadId: t.leadId,
          leadName: t.lead?.user?.name ?? null,
          memberIds: t.members.map((m) => m.memberId),
          memberNames: t.members.map((m) => m.member.user.name),
          projects: t._count.projects,
          tasks: t._count.tasks,
        }))}
        departments={departments}
        members={members}
        canWrite={permits(app.org.role, "teams.write")}
        canDelete={permits(app.org.role, "teams.delete")}
      />
    </AppShell>
  );
}