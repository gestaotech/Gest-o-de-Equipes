import type { Metadata } from "next";
import { getAppShellData } from "@/server/page-data";
import { prisma } from "@/lib/prisma";
import { permits } from "@/lib/rbac";
import { AppShell } from "@/components/app-shell/app-shell";
import { TasksClient } from "./client";

export const metadata: Metadata = { title: "Tarefas" };

export default async function TarefasPage({
  searchParams,
}: {
  searchParams: Promise<{ criar?: string; abrir?: string }>;
}) {
  const app = await getAppShellData();
  const { criar, abrir } = await searchParams;

  const [tasks, projects, teams, members] = await Promise.all([
    prisma.task.findMany({
      where: { organizationId: app.org.id },
      include: {
        project: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        assignees: {
          include: {
            member: {
              include: { user: { select: { id: true, name: true } } },
            },
          },
        },
        comments: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
        createdBy: { select: { name: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 250,
    }),
    prisma.project.findMany({
      where: { organizationId: app.org.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.team.findMany({
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
      <TasksClient
        tasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          projectId: t.projectId,
          projectName: t.project?.name ?? null,
          teamId: t.teamId,
          teamName: t.team?.name ?? null,
          dueDate: t.dueDate,
          startDate: t.startDate,
          assignees: t.assignees.map((a) => ({
            id: a.memberId,
            name: a.member.user.name,
            userId: a.member.user.id,
          })),
          comments: t.comments.map((c) => ({
            id: c.id,
            text: c.text,
            userName: c.user?.name ?? "Sistema",
            createdAt: c.createdAt,
          })),
          createdByName: t.createdBy?.name ?? "Sistema",
        }))}
        projects={projects}
        teams={teams}
        members={members}
        selfMemberId={app.membershipId}
        selfUserId={app.session.sub}
        canWrite={permits(app.org.role, "tasks.write")}
        canDelete={permits(app.org.role, "tasks.delete")}
        openNew={criar === "1"}
        openTaskId={abrir ?? null}
      />
    </AppShell>
  );
}