"use server";

import { prisma } from "@/lib/prisma";
import { requireSessionApi, getActiveOrg } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import type { OrganizationMember } from "@prisma/client";
import type { SessionPayload } from "@/lib/auth";

/** Obter organização ativa da sessão do usuário */
export async function getUserOrg(): Promise<{ orgId: string; orgName: string; membership: OrganizationMember }> {
  const session: SessionPayload = await requireSessionApi();
  const org = await getActiveOrg(session);

  if (!org) {
    throw new AppError("NO_ORG", "Você não pertence a nenhuma organização ativa.", 404);
  }

  return {
    orgId: org.id,
    orgName: org.name,
    membership: org.membership,
  };
}

/** Verificar se o usuário pode acessar um projeto */
export async function canAccessProject(projectId: string): Promise<boolean> {
  const { orgId } = await getUserOrg();

  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId: orgId, status: "ATIVO" },
  });

  if (!membership) return false;

  // OWNER e MANAGER podem acessar quaisquer projetos
  if (membership.role === "OWNER" || membership.role === "MANAGER") return true;

  // MEMBER e LEADER só podem acessar projetos dos quais participam
  const projectMember = await prisma.projectMember.findFirst({
    where: { projectId, memberId: membership.id },
  });

  return !!projectMember;
}

/** Verificar se o usuário pode acessar uma tarefa */
export async function canAccessTask(taskId: string): Promise<boolean> {
  const { orgId } = await getUserOrg();

  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId: orgId, status: "ATIVO" },
  });

  if (!membership) return false;

  // Buscar a tarefa e verificar o assignment
  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId: orgId },
    include: {
      assignees: {
        include: { member: true },
      },
    },
  });

  return !!task;
}

/** Verificar se o usuário pode acessar uma equipe */
export async function canAccessTeam(teamId: string): Promise<boolean> {
  const { orgId } = await getUserOrg();

  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId: orgId, status: "ATIVO" },
  });

  if (!membership) return false;

  // OWNER e MANAGER podem acessar quaisquer equipes
  if (membership.role === "OWNER" || membership.role === "MANAGER") return true;

  // Verificar se o membro faz parte da equipe
  const teamMember = await prisma.teamMember.findFirst({
    where: { teamId, memberId: membership.id },
  });

  return !!teamMember;
}

/** Verificar se o usuário pode acessar um departamento */
export async function canAccessDepartment(departmentId: string): Promise<boolean> {
  const { orgId } = await getUserOrg();

  const department = await prisma.department.findFirst({
    where: { id: departmentId, organizationId: orgId },
  });

  return !!department;
}

/** Verificar se o usuário pode acessar um evento */
export async function canAccessEvent(eventId: string): Promise<boolean> {
  const { orgId } = await getUserOrg();

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: orgId },
  });

  return !!event;
}

/** Verificar se o usuário pode acessar um aviso */
export async function canAccessAnnouncement(announcementId: string): Promise<boolean> {
  const { orgId } = await getUserOrg();

  const announcement = await prisma.announcement.findFirst({
    where: { id: announcementId, organizationId: orgId },
  });

  return !!announcement;
}

/** Verificar se o usuário pode acessar uma meta */
export async function canAccessGoal(goalId: string): Promise<boolean> {
  const { orgId } = await getUserOrg();

  const goal = await prisma.goal.findFirst({
    where: { id: goalId, organizationId: orgId },
  });

  return !!goal;
}

/** Verificar se o usuário pode acessar indicadores */
export async function canAccessIndicators(): Promise<boolean> {
  const { orgId } = await getUserOrg();
  // Todos os usuários autenticados da organização podem ver indicadores
  return true;
}