import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAppShellData } from "@/server/page-data";
import { prisma } from "@/lib/prisma";
import { permits } from "@/lib/rbac";
import {
  departmentVisibilityWhere,
  getPageDataScope,
  teamVisibilityWhere,
  visibleMembersWhere,
  withTeamRelations,
  announcementVisibilityWhere,
} from "@/server/scope";
import { AppShell } from "@/components/app-shell/app-shell";
import { AnnouncementsClient } from "./client";

export const metadata: Metadata = { title: "Avisos" };

export default async function AvisosPage() {
  const app = await getAppShellData();

  // Data Scope por AUDIÊNCIA (company | department | team | user).
  // Antes considerava apenas `company` e `user`, ignorando avisos de
  // equipe/departamento — e as listas de apoio vazavam a organização inteira.
  const base = await getPageDataScope(redirect);
  const scope = await withTeamRelations(base);

  const [announcements, teams, departments, members] = await Promise.all([
    prisma.announcement.findMany({
      where: announcementVisibilityWhere(scope),
      include: {
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.team.findMany({
      where: { ...teamVisibilityWhere(scope), archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where: { ...departmentVisibilityWhere(scope), archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.organizationMember.findMany({
      where: visibleMembersWhere(scope),
      select: { id: true, user: { select: { id: true, name: true } } },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <AnnouncementsClient
        announcements={announcements.map((a) => ({
          id: a.id,
          title: a.title,
          message: a.message,
          audience: a.audience,
          createdByName: a.createdBy?.name ?? "Sistema",
          createdAt: a.createdAt,
        }))}
        teams={teams}
        departments={departments}
        members={members}
        canWrite={permits(app.org.role, "announcements.write")}
        canDelete={permits(app.org.role, "announcements.delete")}
      />
    </AppShell>
  );
}