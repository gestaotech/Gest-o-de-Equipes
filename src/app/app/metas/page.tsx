import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAppShellData } from "@/server/page-data";
import { prisma } from "@/lib/prisma";
import { permits } from "@/lib/rbac";
import {
  getPageDataScope,
  goalVisibilityWhere,
  teamVisibilityWhere,
  visibleMembersWhere,
} from "@/server/scope";
import { AppShell } from "@/components/app-shell/app-shell";
import { GoalsClient } from "./client";

export const metadata: Metadata = { title: "Metas" };

export default async function MetasPage() {
  const app = await getAppShellData();

  // Data Scope: MEMBER só enxerga metas das quais é responsável ou membro.
  const scope = await getPageDataScope(redirect);

  const [goals, teams, members] = await Promise.all([
    prisma.goal.findMany({
      where: goalVisibilityWhere(scope),
      include: {
        responsible: { include: { user: { select: { name: true } } } },
        team: { select: { id: true, name: true } },
        members: { include: { member: { include: { user: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.team.findMany({
      where: { ...teamVisibilityWhere(scope), archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.organizationMember.findMany({
      where: visibleMembersWhere(scope),
      select: { id: true, user: { select: { name: true } } },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <GoalsClient
        goals={goals.map((g) => ({
          id: g.id,
          title: g.title,
          description: g.description,
          status: g.status,
          responsibleId: g.responsibleId,
          responsibleName: g.responsible?.user?.name ?? null,
          teamId: g.teamId,
          teamName: g.team?.name ?? null,
          startValue: g.startValue,
          targetValue: g.targetValue,
          progress: g.progress,
          dueDate: g.dueDate,
          memberIds: g.members.map((m) => m.memberId),
          memberNames: g.members.map((m) => m.member.user.name),
        }))}
        teams={teams}
        members={members}
        canWrite={permits(app.org.role, "goals.write")}
        canDelete={permits(app.org.role, "goals.delete")}
      />
    </AppShell>
  );
}