import type { Metadata } from "next";
import { getAppShellData } from "@/server/page-data";
import { prisma } from "@/lib/prisma";
import { permits } from "@/lib/rbac";
import { AppShell } from "@/components/app-shell/app-shell";
import { AnnouncementsClient } from "./client";

export const metadata: Metadata = { title: "Avisos" };

export default async function AvisosPage() {
  const app = await getAppShellData();
  const [announcements, teams, departments, members] = await Promise.all([
    prisma.announcement.findMany({
      where: {
        organizationId: app.org.id,
        OR: [
          { audience: "company" },
          { audience: "user", audienceId: app.session.sub },
        ],
      },
      include: {
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
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