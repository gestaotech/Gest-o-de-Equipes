import type { Metadata } from "next";
import { getAppShellData } from "@/server/page-data";
import { getOrgMembers } from "@/server/guards";
import { prisma } from "@/lib/prisma";
import { permits } from "@/lib/rbac";
import { AppShell } from "@/components/app-shell/app-shell";
import { TeammatesClient } from "./client";

export const metadata: Metadata = { title: "Colaboradores" };

export default async function ColaboradoresPage() {
  const app = await getAppShellData();
  const [members, teams, departments, managers] = await Promise.all([
    getOrgMembers(app.org.id),
    prisma.team.findMany({
      where: { organizationId: app.org.id, archivedAt: null },
      select: { id: true, name: true },
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
        user: { select: { name: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <TeammatesClient
        members={members.map((m) => ({
          id: m.id,
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
          status: m.status,
          jobTitle: m.jobTitle,
          phone: m.phone,
          entryDate: m.entryDate,
          departmentId: m.departmentId,
          teamIds: m.teamMembers.map((t) => t.team.id),
          managerId: m.managerId,
          managerName: m.manager?.user?.name ?? null,
        }))}
        selfMemberId={app.membershipId}
        canWrite={permits(app.org.role, "users.write")}
        canDelete={permits(app.org.role, "users.delete")}
        teams={teams}
        departments={departments}
        managers={managers}
      />
    </AppShell>
  );
}