"use server";

import { prisma } from "@/lib/prisma";
import { handleAction, AppError, ok } from "@/lib/errors";
import {
  departmentSchema,
  teamSchema,
  collaboratorSchema,
} from "@/lib/validations";
import { getContext, guardPerm } from "@/server/guards";
import { logActivity } from "@/server/activity";
import { hashPassword } from "@/lib/auth";

const normalizeEmail = (e: string) => e.trim().toLowerCase();

// ------------------------------------------------------------
// DEPARTAMENTOS
// ------------------------------------------------------------

export async function createDepartment(input: unknown) {
  return handleAction(async () => {
    const { orgId, session, membership } = await getContext();
    guardPerm(membership, "departments.write");
    const data = departmentSchema.parse(input);
    const name = data.name.trim();
    const exists = await prisma.department.findFirst({
      where: { organizationId: orgId, name },
    });
    if (exists) throw new AppError("DUPLICATE", "Já existe um departamento com esse nome.", 409);
    const dept = await prisma.department.create({
      data: { organizationId: orgId, name, description: data.description || null },
    });
    await logActivity(orgId, session.sub, "department.created", "department", dept.id, { name });
    return { id: dept.id, name: dept.name };
  });
}

export async function updateDepartment(input: { id: string } & Record<string, unknown>) {
  return handleAction(async () => {
    const { orgId, session, membership } = await getContext();
    guardPerm(membership, "departments.write");
    const data = departmentSchema.parse(input);
    const name = data.name.trim();
    const dept = await prisma.department.findFirst({
      where: { id: input.id, organizationId: orgId },
    });
    if (!dept) throw new AppError("NOT_FOUND", "Departamento não encontrado.", 404);
    const dup = await prisma.department.findFirst({
      where: { organizationId: orgId, name, NOT: { id: dept.id } },
    });
    if (dup) throw new AppError("DUPLICATE", "Já existe um departamento com esse nome.", 409);
    await prisma.department.update({
      where: { id: dept.id },
      data: { name, description: data.description || null },
    });
    await logActivity(orgId, session.sub, "department.updated", "department", dept.id, { name });
    return ok({});
  });
}

export async function deleteDepartment(id: string) {
  return handleAction(async () => {
    const { orgId, session, membership } = await getContext();
    guardPerm(membership, "departments.delete");
    const dept = await prisma.department.findFirst({ where: { id, organizationId: orgId } });
    if (!dept) throw new AppError("NOT_FOUND", "Departamento não encontrado.", 404);
    await prisma.department.delete({ where: { id } });
    await logActivity(orgId, session.sub, "department.deleted", "department", id, {});
    return ok({});
  });
}

// ------------------------------------------------------------
// EQUIPES
// ------------------------------------------------------------

export async function createTeam(input: unknown) {
  return handleAction(async () => {
    const { orgId, session, membership } = await getContext();
    guardPerm(membership, "teams.write");
    const data = teamSchema.parse(input);
    const name = data.name.trim();
    const exists = await prisma.team.findFirst({
      where: { organizationId: orgId, name },
    });
    if (exists) throw new AppError("DUPLICATE", "Já existe uma equipe com esse nome.", 409);
    const team = await prisma.team.create({
      data: {
        organizationId: orgId,
        name,
        description: data.description || null,
        departmentId: data.departmentId || null,
        leadId: data.leadId || null,
        members: {
          create: data.memberIds.map((m) => ({ memberId: m })),
        },
      },
    });
    await logActivity(orgId, session.sub, "team.created", "team", team.id, {
      name,
      members: data.memberIds.length,
    });
    return { id: team.id, name: team.name };
  });
}

export async function updateTeam(input: { id: string } & Record<string, unknown>) {
  return handleAction(async () => {
    const { orgId, session, membership } = await getContext();
    guardPerm(membership, "teams.write");
    const data = teamSchema.parse(input);
    const team = await prisma.team.findFirst({ where: { id: input.id, organizationId: orgId } });
    if (!team) throw new AppError("NOT_FOUND", "Equipe não encontrada.", 404);
    const dup = await prisma.team.findFirst({
      where: { organizationId: orgId, name: data.name.trim(), NOT: { id: team.id } },
    });
    if (dup) throw new AppError("DUPLICATE", "Já existe uma equipe com esse nome.", 409);
    await prisma.$transaction([
      prisma.team.update({
        where: { id: team.id },
        data: {
          name: data.name.trim(),
          description: data.description || null,
          departmentId: data.departmentId || null,
          leadId: data.leadId || null,
        },
      }),
      prisma.teamMember.deleteMany({ where: { teamId: team.id } }),
      prisma.teamMember.createMany({
        data: data.memberIds.map((m) => ({ teamId: team.id, memberId: m })),
      }),
    ]);
    await logActivity(orgId, session.sub, "team.updated", "team", team.id, {
      name: data.name.trim(),
    });
    return ok({});
  });
}

export async function deleteTeam(id: string) {
  return handleAction(async () => {
    const { orgId, session, membership } = await getContext();
    guardPerm(membership, "teams.delete");
    const team = await prisma.team.findFirst({ where: { id, organizationId: orgId } });
    if (!team) throw new AppError("NOT_FOUND", "Equipe não encontrada.", 404);
    await prisma.team.delete({ where: { id } });
    await logActivity(orgId, session.sub, "team.deleted", "team", id, {});
    return ok({});
  });
}

// ------------------------------------------------------------
// COLABORADORES
// ------------------------------------------------------------

export async function addCollaborator(input: unknown) {
  return handleAction(async () => {
    const { orgId, session, membership } = await getContext();
    guardPerm(membership, "users.write");
    const data = collaboratorSchema.parse(input);
    const email = data.email ? normalizeEmail(data.email) : null;

    let userId: string;
    let createdUser = false;

    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        userId = existing.id;
        const already = await prisma.organizationMember.findFirst({
          where: { organizationId: orgId, userId },
        });
        if (already) {
          throw new AppError("EXISTS", "Este colaborador já pertence à organização.", 409);
        }
      } else {
        const u = await prisma.user.create({
          data: {
            name: data.name.trim(),
            email,
            passwordHash: await hashPassword(
              Math.random().toString(36).slice(2) + Date.now().toString(36)
            ),
          },
        });
        userId = u.id;
        createdUser = true;
      }
    } else {
      // Sem e-mail: cria usuário de caixa com e-mail derivado (sem login real).
      const base = slugify(data.name.trim()) || "colaborador";
      const localEmail = `${base}@sem-email.teamflow`;
      const u = await prisma.user.create({
        data: {
          name: data.name.trim(),
          email: localEmail,
          passwordHash: await hashPassword(Math.random().toString(36)),
        },
      });
      userId = u.id;
      createdUser = true;
    }

    const role = (
      data.permission && ["OWNER", "ADMIN", "MANAGER", "LEADER", "MEMBER"].includes(data.permission)
        ? data.permission
        : "MEMBER"
    ) as "OWNER" | "ADMIN" | "MANAGER" | "LEADER" | "MEMBER";

    const member = await prisma.organizationMember.create({
      data: {
        organizationId: orgId,
        userId,
        role,
        jobTitle: data.jobTitle || data.role || null,
        phone: data.phone || null,
        departmentId: data.departmentId || null,
        managerId: data.managerId || null,
        entryDate: data.entryDate ? new Date(data.entryDate) : null,
      },
    });

    if (data.teamId) {
      await prisma.teamMember.create({
        data: { teamId: data.teamId, memberId: member.id },
      });
    }

    await logActivity(orgId, session.sub, "member.created", "member", member.id, {
      name: data.name,
      role,
      created: createdUser ? "user+member" : "member",
    });
    return { id: member.id, createdUser };
  });
}

function slugify(t: string) {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function updateCollaborator(input: { id: string } & Record<string, unknown>) {
  return handleAction(async () => {
    const { orgId, session, membership } = await getContext();
    guardPerm(membership, "users.write");
    const data = collaboratorSchema.parse(input);
    const member = await prisma.organizationMember.findFirst({
      where: { id: input.id, organizationId: orgId },
    });
    if (!member) throw new AppError("NOT_FOUND", "Colaborador não encontrado.", 404);
    const role = (
      data.permission && ["OWNER", "ADMIN", "MANAGER", "LEADER", "MEMBER"].includes(data.permission)
        ? data.permission
        : member.role
    ) as "OWNER" | "ADMIN" | "MANAGER" | "LEADER" | "MEMBER";

    await prisma.organizationMember.update({
      where: { id: member.id },
      data: {
        role,
        jobTitle: data.jobTitle || data.role || member.jobTitle,
        phone: data.phone != null ? data.phone : member.phone,
        departmentId: data.departmentId ?? member.departmentId,
        managerId: data.managerId ?? member.managerId,
        entryDate: data.entryDate ? new Date(data.entryDate) : member.entryDate,
      },
    });
    await prisma.user.update({
      where: { id: member.userId },
      data: { name: data.name.trim() },
      select: { id: true },
    });
    await prisma.teamMember.deleteMany({ where: { memberId: member.id } });
    if (data.teamId) {
      await prisma.teamMember.create({
        data: { teamId: data.teamId, memberId: member.id },
      });
    }
    await logActivity(orgId, session.sub, "member.updated", "member", member.id, {
      name: data.name,
    });
    return ok({});
  });
}

export async function removeCollaborator(id: string) {
  return handleAction(async () => {
    const { orgId, session, membership } = await getContext();
    guardPerm(membership, "users.delete");
    const member = await prisma.organizationMember.findFirst({
      where: { id, organizationId: orgId },
      include: { user: { select: { name: true } } },
    });
    if (!member) throw new AppError("NOT_FOUND", "Colaborador não encontrado.", 404);
    if (member.id === membership.id) {
      throw new AppError("SELF_REMOVE", "Você não pode remover a si mesmo.", 400);
    }
    await prisma.organizationMember.delete({ where: { id: member.id } });
    await logActivity(orgId, session.sub, "member.deleted", "member", id, {
      name: member.user.name,
    });
    return ok({});
  });
}

export async function setMemberRole(input: { id: string; role: string }) {
  return handleAction(async () => {
    const { orgId, session, membership } = await getContext();
    guardPerm(membership, "users.write");
    const allowed = ["OWNER", "ADMIN", "MANAGER", "LEADER", "MEMBER"] as const;
    if (!allowed.includes(input.role as (typeof allowed)[number])) {
      throw new AppError("INVALID", "Papel inválido.", 400);
    }
    const role = input.role as (typeof allowed)[number];
    const member = await prisma.organizationMember.findFirst({
      where: { id: input.id, organizationId: orgId },
    });
    if (!member) throw new AppError("NOT_FOUND", "Colaborador não encontrado.", 404);
    if (member.role === "OWNER" && role !== "OWNER" && member.userId !== session.sub) {
      throw new AppError("LAST_OWNER", "Transferência de propriedade não suportada ainda.", 400);
    }
    if (member.userId === session.sub && role === "MEMBER") {
      throw new AppError("SELF_DEMOTE", "Você não pode rebaixar a si mesmo para Membro.", 400);
    }
    await prisma.organizationMember.update({
      where: { id: member.id },
      data: { role },
    });
    await logActivity(orgId, session.sub, "member.role", "member", member.id, { role });
    return ok({});
  });
}