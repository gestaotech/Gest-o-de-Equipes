import { prisma } from "@/lib/prisma";

export { activityLabel } from "@/lib/activity-labels";

export async function getOrgStats(orgId: string) {
  const [
    members,
    tasks,
    projects,
    teams,
    departments,
    goals,
    events,
    lateTasks,
    doneTasks,
    activeProjects,
  ] = await Promise.all([
    prisma.organizationMember.count({ where: { organizationId: orgId, status: "ATIVO" } }),
    prisma.task.count({ where: { organizationId: orgId } }),
    prisma.project.count({ where: { organizationId: orgId } }),
    prisma.team.count({ where: { organizationId: orgId, archivedAt: null } }),
    prisma.department.count({ where: { organizationId: orgId, archivedAt: null } }),
    prisma.goal.count({ where: { organizationId: orgId } }),
    prisma.event.count({
      where: {
        organizationId: orgId,
        startsAt: { gte: new Date() },
        endsAt: { gte: new Date() },
      },
    }),
    prisma.task.count({
      where: {
        organizationId: orgId,
        status: { not: "DONE" },
        dueDate: { lt: new Date() },
      },
    }),
    prisma.task.count({
      where: { organizationId: orgId, status: "DONE" },
    }),
    prisma.project.count({
      where: { organizationId: orgId, status: { in: ["EM_ANDAMENTO", "PLANEJAMENTO"] } },
    }),
  ]);
  return {
    members,
    tasks: { total: tasks, done: doneTasks },
    projects: { total: projects, active: activeProjects },
    teams,
    departments,
    goals,
    events,
    lateTasks,
  };
}

export async function getRecentActivity(orgId: string, limit = 8) {
  const logs = await prisma.activityLog.findMany({
    where: { organizationId: orgId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return logs;
}

export async function getUpcomingEvents(orgId: string, limit = 5) {
  return prisma.event.findMany({
    where: {
      organizationId: orgId,
      startsAt: { gte: new Date() },
    },
    orderBy: { startsAt: "asc" },
    take: limit,
  });
}

export async function getUpcomingTasks(orgId: string, memberId?: string, limit = 6) {
  return prisma.task.findMany({
    where: {
      organizationId: orgId,
      status: { not: "DONE" },
      ...(memberId
        ? { assignees: { some: { memberId } } }
        : {}),
    },
    include: {
      project: { select: { id: true, name: true } },
      assignees: {
        include: {
          member: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: limit,
  });
}