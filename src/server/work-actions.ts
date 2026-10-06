"use server";

import { prisma } from "@/lib/prisma";
import { handleAction, AppError, ok } from "@/lib/errors";
import {
  projectSchema,
  taskSchema,
  commentSchema,
  goalSchema,
  eventSchema,
  announcementSchema,
} from "@/lib/validations";
import { getContext, guardPerm, validateOrgReferences } from "@/server/guards";
import {
  requireDataScope,
  canAccessGoal,
  canAccessProject,
  canAccessTask,
} from "@/server/scope";
import { logActivity, notify } from "@/server/activity";
import type {
  ProjectStatus,
  ProjectPriority,
  TaskStatus,
  TaskPriority,
  GoalStatus,
} from "@prisma/client";

function projectStatus(v?: string): ProjectStatus {
  const map = ["PLANEJAMENTO", "EM_ANDAMENTO", "PAUSADO", "CONCLUIDO"];
  return v && map.includes(v) ? (v as ProjectStatus) : "PLANEJAMENTO";
}

function goalStatus(v?: string): GoalStatus {
  const map = ["PLANEJAMENTO", "EM_ANDAMENTO", "CONCLUIDO"];
  return v && map.includes(v) ? (v as GoalStatus) : "EM_ANDAMENTO";
}

function taskStatus(v?: string): TaskStatus {
  const map = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
  return v && map.includes(v) ? (v as TaskStatus) : "TODO";
}

function taskPriority(v?: string): TaskPriority {
  const map = ["LOW", "MEDIUM", "HIGH", "URGENT"];
  return v && map.includes(v) ? (v as TaskPriority) : "MEDIUM";
}

function projectPriority(v?: string): ProjectPriority {
  const map = ["LOW", "MEDIUM", "HIGH", "URGENT"];
  return v && map.includes(v) ? (v as ProjectPriority) : "MEDIUM";
}

// ------------------------------------------------------------
// PROJETOS
// ------------------------------------------------------------

export async function createProject(input: unknown) {
  return handleAction(async () => {
    const { orgId, session, membership } = await getContext();
    guardPerm(membership, "projects.write");
    const data = projectSchema.parse(input);
    await validateOrgReferences(orgId, {
      teams: [data.teamId],
      members: [data.responsibleId, ...data.memberIds],
    });
    const project = await prisma.project.create({
      data: {
        organizationId: orgId,
        name: data.name.trim(),
        description: data.description || null,
        status: projectStatus(data.status),
        priority: projectPriority(data.priority),
        startDate: data.startDate ? new Date(data.startDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        teamId: data.teamId || null,
        responsibleId: data.responsibleId || null,
        createdById: session.sub,
        members: {
          create: data.memberIds.map((m) => ({ memberId: m })),
        },
      },
    });
    await logActivity({
      action: "project.created",
      entity: "project",
      entityId: project.id,
      newData: {
        name: project.name,
      },
    });
    return { id: project.id, name: project.name };
  });
}

export async function updateProject(input: { id: string } & Record<string, unknown>) {
  return handleAction(async () => {
    const scope = await requireDataScope();
    const { orgId, membership } = scope;
    guardPerm(membership, "projects.write");
    const data = projectSchema.parse(input);
    if (!(await canAccessProject(scope, input.id))) {
      throw new AppError("FORBIDDEN", "Projeto fora do seu escopo.", 403);
    }
    const project = await prisma.project.findFirst({
      where: { id: input.id, organizationId: orgId },
    });
    if (!project) throw new AppError("NOT_FOUND", "Projeto não encontrado.", 404);
    await validateOrgReferences(orgId, {
      teams: [data.teamId],
      members: [data.responsibleId, ...data.memberIds],
    });
await prisma.project.update({
       where: { id: project.id },
       data: {
         name: data.name.trim(),
         description: data.description || null,
         status: projectStatus(data.status),
         priority: projectPriority(data.priority),
         startDate: data.startDate ? new Date(data.startDate) : null,
         dueDate: data.dueDate ? new Date(data.dueDate) : null,
         teamId: data.teamId || null,
         responsibleId: data.responsibleId || null,
       },
     });
    await prisma.projectMember.deleteMany({ where: { projectId: project.id } });
    if (data.memberIds.length) {
      await prisma.projectMember.createMany({
        data: data.memberIds.map((m) => ({ projectId: project.id, memberId: m })),
      });
    }
    await logActivity({
      action: "project.updated",
      entity: "project",
      entityId: project.id,
      newData: {
        name: data.name,
      },
    });
    return ok({});
  });
}

export async function deleteProject(id: string) {
  return handleAction(async () => {
    const { orgId, membership } = await getContext();
    guardPerm(membership, "projects.delete");
    const project = await prisma.project.findFirst({ where: { id, organizationId: orgId } });
    if (!project) throw new AppError("NOT_FOUND", "Projeto não encontrado.", 404);
    await prisma.project.delete({ where: { id: project.id } });
    await logActivity({
      action: "project.deleted",
      entity: "project",
      entityId: id,
      newData: {},
    });
    return ok({});
  });
}

// ------------------------------------------------------------
// TAREFAS
// ------------------------------------------------------------

export async function createTask(input: unknown) {
  return handleAction(async () => {
    const { orgId, session, membership } = await getContext();
    guardPerm(membership, "tasks.write");
    const data = taskSchema.parse(input);
    await validateOrgReferences(orgId, {
      teams: [data.teamId],
      projects: [data.projectId],
      members: data.assigneeIds,
    });
    const task = await prisma.task.create({
      data: {
        organizationId: orgId,
        title: data.title.trim(),
        description: data.description || null,
        status: taskStatus(data.status),
        priority: taskPriority(data.priority),
        projectId: data.projectId || null,
        teamId: data.teamId || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        createdById: session.sub,
        assignees: {
          create: data.assigneeIds.map((m) => ({ memberId: m })),
        },
      },
    });
    await logActivity({
      action: "task.created",
      entity: "task",
      entityId: task.id,
      newData: {
        title: task.title,
      },
    });
    return { id: task.id, title: task.title };
  });
}

export async function updateTask(input: { id: string } & Record<string, unknown>) {
  return handleAction(async () => {
    const scope = await requireDataScope();
    const { orgId, membership } = scope;
    guardPerm(membership, "tasks.write");
    const data = taskSchema.parse(input);
    if (!(await canAccessTask(scope, input.id))) {
      throw new AppError("FORBIDDEN", "Tarefa fora do seu escopo.", 403);
    }
    const task = await prisma.task.findFirst({
      where: { id: input.id, organizationId: orgId },
    });
    if (!task) throw new AppError("NOT_FOUND", "Tarefa não encontrada.", 404);
    await validateOrgReferences(orgId, {
      teams: [data.teamId],
      projects: [data.projectId],
      members: data.assigneeIds,
    });
    const status = taskStatus(data.status);
    const completed = status === "DONE";
await prisma.task.update({
       where: { id: task.id },
       data: {
         title: data.title.trim(),
         description: data.description || null,
         status,
         priority: taskPriority(data.priority),
         projectId: data.projectId || null,
         teamId: data.teamId || null,
         startDate: data.startDate ? new Date(data.startDate) : null,
         dueDate: data.dueDate ? new Date(data.dueDate) : null,
         completedAt:
           completed !== Boolean(task.completedAt) ? (completed ? new Date() : null) : task.completedAt,
       },
     });
    await prisma.taskAssignee.deleteMany({ where: { taskId: task.id } });
    if (data.assigneeIds.length) {
      await prisma.taskAssignee.createMany({
        data: data.assigneeIds.map((m) => ({ taskId: task.id, memberId: m })),
      });
    }
    await logActivity({
      action: "task.updated",
      entity: "task",
      entityId: task.id,
      newData: {
        title: data.title,
      },
    });
    return ok({});
  });
}

export async function setTaskStatus(input: { id: string; status: string }) {
  return handleAction(async () => {
    const scope = await requireDataScope();
    const { orgId, membership } = scope;
    guardPerm(membership, "tasks.write");
    if (!(await canAccessTask(scope, input.id))) {
      throw new AppError("FORBIDDEN", "Tarefa fora do seu escopo.", 403);
    }
    const status = taskStatus(input.status);
    const task = await prisma.task.findFirst({
      where: { id: input.id, organizationId: orgId },
    });
    if (!task) throw new AppError("NOT_FOUND", "Tarefa não encontrada.", 404);
    const completed = status === "DONE";
await prisma.task.update({
       where: { id: task.id },
       data: {
         status,
         completedAt: completed ? new Date() : completed === false && task.completedAt ? null : task.completedAt,
       },
     });
    await logActivity({
      action: "task.status",
      entity: "task",
      entityId: task.id,
      newData: { status },
    });
    return ok({});
  });
}

export async function deleteTask(id: string) {
  return handleAction(async () => {
    const { orgId, membership } = await getContext();
    guardPerm(membership, "tasks.delete");
    const task = await prisma.task.findFirst({ where: { id, organizationId: orgId } });
    if (!task) throw new AppError("NOT_FOUND", "Tarefa não encontrada.", 404);
    await prisma.task.delete({ where: { id: task.id } });
    await logActivity({
      action: "task.deleted",
      entity: "task",
      entityId: id,
      newData: {},
    });
    return ok({});
  });
}

// ------------------------------------------------------------
// COMENTÁRIOS
// ------------------------------------------------------------

export async function createComment(input: unknown) {
  return handleAction(async () => {
    const { orgId, session, membership } = await getContext();
    guardPerm(membership, "tasks.write");
    const data = commentSchema.parse(input);
    const task = await prisma.task.findFirst({
      where: { id: data.taskId, organizationId: orgId },
    });
    if (!task) throw new AppError("NOT_FOUND", "Tarefa não encontrada.", 404);
    const comment = await prisma.taskComment.create({
      data: { taskId: task.id, userId: session.sub, text: data.text.trim() },
    });
    await logActivity({
      action: "task.comment",
      entity: "task",
      entityId: task.id,
      newData: {
        commentId: comment.id,
        textLength: comment.text.length,
      },
    });
    return { id: comment.id, createdAt: comment.createdAt.toISOString() };
  });
}

// ------------------------------------------------------------
// METAS
// ------------------------------------------------------------

export async function createGoal(input: unknown) {
  return handleAction(async () => {
    const { orgId, membership } = await getContext();
    guardPerm(membership, "goals.write");
    const data = goalSchema.parse(input);
    await validateOrgReferences(orgId, {
      teams: [data.teamId],
      members: [data.responsibleId],
    });
    const targetValue = data.targetValue ?? 100;
    const startValue = data.startValue ?? 0;
    const goal = await prisma.goal.create({
      data: {
        organizationId: orgId,
        title: data.title.trim(),
        description: data.description || null,
        responsibleId: data.responsibleId || null,
        teamId: data.teamId || null,
        startValue,
        targetValue,
        progress: targetValue ? Math.min(100, Math.round((startValue / targetValue) * 100)) : 0,
        status: goalStatus(data.status),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
    });
    await logActivity({
      action: "goal.created",
      entity: "goal",
      entityId: goal.id,
      newData: {
        title: goal.title,
      },
    });
    return { id: goal.id };
  });
}

export async function updateGoal(input: { id: string } & Record<string, unknown>) {
  return handleAction(async () => {
    const scope = await requireDataScope();
    const { orgId, membership } = scope;
    guardPerm(membership, "goals.write");
    const data = goalSchema.parse(input);
    if (!(await canAccessGoal(scope, input.id))) {
      throw new AppError("FORBIDDEN", "Meta fora do seu escopo.", 403);
    }
    const goal = await prisma.goal.findFirst({
      where: { id: input.id, organizationId: orgId },
    });
    if (!goal) throw new AppError("NOT_FOUND", "Meta não encontrada.", 404);
    await validateOrgReferences(orgId, {
      teams: [data.teamId ?? goal.teamId],
      members: [data.responsibleId ?? goal.responsibleId],
    });
    const startValue = data.startValue ?? goal.startValue;
    const targetValue = data.targetValue ?? goal.targetValue;
    const progress = targetValue ? Math.min(100, Math.round((startValue / targetValue) * 100)) : 0;
await prisma.goal.update({
       where: { id: goal.id },
       data: {
         title: data.title.trim(),
         description: data.description || null,
         responsibleId: data.responsibleId ?? goal.responsibleId,
         teamId: data.teamId ?? goal.teamId,
         startValue,
         targetValue,
         progress,
         status: data.status ? goalStatus(data.status) : goal.status,
         dueDate: data.dueDate ? new Date(data.dueDate) : goal.dueDate,
       },
     });
    await logActivity({
      action: "goal.updated",
      entity: "goal",
      entityId: goal.id,
      newData: {},
    });
    return ok({});
  });
}

export async function deleteGoal(id: string) {
  return handleAction(async () => {
    const { orgId, membership } = await getContext();
    guardPerm(membership, "goals.delete");
    const goal = await prisma.goal.findFirst({ where: { id, organizationId: orgId } });
    if (!goal) throw new AppError("NOT_FOUND", "Meta não encontrada.", 404);
    await prisma.goal.delete({ where: { id: goal.id } });
    await logActivity({
      action: "goal.deleted",
      entity: "goal",
      entityId: id,
      newData: {},
    });
    return ok({});
  });
}

// ------------------------------------------------------------
// EVENTOS / AGENDA
// ------------------------------------------------------------

export async function createEvent(input: unknown) {
  return handleAction(async () => {
    const { orgId, session, membership } = await getContext();
    guardPerm(membership, "agenda.write");
    const data = eventSchema.parse(input);
    await validateOrgReferences(orgId, {
      teams: [data.teamId],
      projects: [data.projectId],
    });
    const event = await prisma.event.create({
      data: {
        organizationId: orgId,
        title: data.title.trim(),
        description: data.description || null,
        type: data.type || "evento",
        allDay: data.allDay ?? false,
        startsAt: new Date(data.startsAt),
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        userId: data.type === "pessoal" ? session.sub : null,
        teamId: data.teamId || null,
        projectId: data.projectId || null,
      },
    });
    await logActivity({
      action: "event.created",
      entity: "event",
      entityId: event.id,
      newData: {
        title: event.title,
      },
    });
    return { id: event.id };
  });
}

export async function deleteEvent(id: string) {
  return handleAction(async () => {
    const { orgId, session, membership } = await getContext();
    guardPerm(membership, "agenda.write");
    const event = await prisma.event.findFirst({ where: { id, organizationId: orgId } });
    if (!event) throw new AppError("NOT_FOUND", "Evento não encontrado.", 404);
    if (
      event.userId &&
      event.userId !== session.sub &&
      !["OWNER", "ADMIN", "MANAGER"].includes(membership.role)
    ) {
      throw new AppError("FORBIDDEN", "Apenas o dono do evento pode excluí-lo.", 403);
    }
    await prisma.event.delete({ where: { id: event.id } });
    await logActivity({
      action: "event.deleted",
      entity: "event",
      entityId: id,
      newData: {},
    });
    return ok({});
  });
}

// ------------------------------------------------------------
// AVISOS
// ------------------------------------------------------------

export async function createAnnouncement(input: unknown) {
  return handleAction(async () => {
    const { orgId, session, membership } = await getContext();
    guardPerm(membership, "announcements.write");
    const data = announcementSchema.parse(input);
    const audience = data.audience || "company";
    if (audience !== "company") {
      if (!data.audienceId) {
        throw new AppError("INVALID", "Defina o público do aviso.", 400);
      }
      if (audience === "team") {
        const team = await prisma.team.findFirst({
          where: { id: data.audienceId, organizationId: orgId },
        });
        if (!team) throw new AppError("INVALID_REF", "Equipe inválida.", 400);
      } else if (audience === "department") {
        const dep = await prisma.department.findFirst({
          where: { id: data.audienceId, organizationId: orgId },
        });
        if (!dep) throw new AppError("INVALID_REF", "Departamento inválido.", 400);
      } else if (audience === "user") {
        const member = await prisma.organizationMember.findFirst({
          where: { organizationId: orgId, userId: data.audienceId },
        });
        if (!member) throw new AppError("INVALID_REF", "Colaborador inválido.", 400);
      }
    }
    const a = await prisma.announcement.create({
      data: {
        organizationId: orgId,
        title: data.title.trim(),
        message: data.message.trim(),
        audience,
        audienceId: data.audienceId || null,
        createdById: session.sub,
      },
    });
    let targets: string[] = [];
    if (audience === "company") {
      const members = await prisma.organizationMember.findMany({
        where: { organizationId: orgId },
        select: { userId: true },
      });
      targets = members.map((m) => m.userId);
    } else if (audience === "team" && data.audienceId) {
      const tm = await prisma.teamMember.findMany({
        where: { teamId: data.audienceId, team: { organizationId: orgId } },
        select: { member: { select: { userId: true } } },
      });
      targets = tm.map((t) => t.member.userId);
    } else if (audience === "department" && data.audienceId) {
      const ms = await prisma.organizationMember.findMany({
        where: { organizationId: orgId, departmentId: data.audienceId },
        select: { userId: true },
      });
      targets = ms.map((m) => m.userId);
    } else if (audience === "user" && data.audienceId) {
      targets = [data.audienceId];
    }
    for (const userId of targets.filter((id) => id !== session.sub)) {
      await notify(orgId, userId, "announcement", a.title, a.message.slice(0, 160));
    }
    await logActivity({
      action: "announcement.created",
      entity: "announcement",
      entityId: a.id,
      newData: {
        title: a.title,
        audience,
      },
    });
    return { id: a.id };
  });
}

export async function deleteAnnouncement(id: string) {
  return handleAction(async () => {
    const { orgId, membership } = await getContext();
    guardPerm(membership, "announcements.delete");
    const a = await prisma.announcement.findFirst({ where: { id, organizationId: orgId } });
    if (!a) throw new AppError("NOT_FOUND", "Aviso não encontrado.", 404);
    await prisma.announcement.delete({ where: { id: a.id } });
    await logActivity({
      action: "announcement.deleted",
      entity: "announcement",
      entityId: id,
      newData: {},
    });
    return ok({});
  });
}

// ------------------------------------------------------------
// NOTIFICAÇÕES
// ------------------------------------------------------------

export async function markNotificationsRead() {
  return handleAction(async () => {
    const { orgId, session } = await getContext();
    await prisma.notification.updateMany({
      where: { organizationId: orgId, userId: session.sub, readAt: null },
      data: { readAt: new Date() },
    });
    return ok({});
  });
}