"use server";

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { handleAction, AppError, ok } from "@/lib/errors";
import {
  departmentSchema,
  teamSchema,
  collaboratorSchema,
} from "@/lib/validations";
import {
  getContext,
  guardPerm,
  guardCanAssign,
  validateOrgReferences,
  canCreateMember,
  canChangeMemberRole,
  guardLastOwnerProtection,
  guardManagerCannotPromoteToOwner,
} from "@/server/guards";
import { logActivity } from "@/server/activity";
import { hashPassword } from "@/lib/auth";
import { ROLE_ORDER } from "@/lib/rbac";

const normalizeEmail = (e: string) => e.trim().toLowerCase();

// ------------------------------------------------------------
// DEPARTAMENTOS
// ------------------------------------------------------------

export async function createDepartment(input: unknown) {
  return handleAction(async () => {
    const { orgId, membership } = await getContext();
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
    await logActivity({
      action: "department.created",
      entity: "department",
      entityId: dept.id,
      newData: { name },
    });
    return { id: dept.id, name: dept.name };
  });
}

export async function updateDepartment(input: { id: string } & Record<string, unknown>) {
  return handleAction(async () => {
    const { orgId, membership } = await getContext();
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
    await logActivity({
      action: "department.updated",
      entity: "department",
      entityId: dept.id,
      newData: { name },
    });
    return ok({});
  });
}

export async function deleteDepartment(id: string) {
  return handleAction(async () => {
    const { orgId, membership } = await getContext();
    guardPerm(membership, "departments.delete");
    const dept = await prisma.department.findFirst({ where: { id, organizationId: orgId } });
    if (!dept) throw new AppError("NOT_FOUND", "Departamento não encontrado.", 404);
    await prisma.department.delete({ where: { id } });
    await logActivity({
      action: "department.deleted",
      entity: "department",
      entityId: id,
      newData: {},
    });
    return ok({});
  });
}

// ------------------------------------------------------------
// EQUIPES
// ------------------------------------------------------------

export async function createTeam(input: unknown) {
  return handleAction(async () => {
    const { orgId, membership } = await getContext();
    guardPerm(membership, "teams.write");
    const data = teamSchema.parse(input);
    const name = data.name.trim();
    const exists = await prisma.team.findFirst({
      where: { organizationId: orgId, name },
    });
    if (exists) throw new AppError("DUPLICATE", "Já existe uma equipe com esse nome.", 409);
    await validateOrgReferences(orgId, {
      members: [data.leadId, ...data.memberIds],
      departments: [data.departmentId],
    });
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
    await logActivity({
      action: "team.created",
      entity: "team",
      entityId: team.id,
      newData: {
        name,
        members: data.memberIds.length,
      },
    });
    return { id: team.id, name: team.name };
  });
}

export async function updateTeam(input: { id: string } & Record<string, unknown>) {
  return handleAction(async () => {
    const { orgId, membership } = await getContext();
    guardPerm(membership, "teams.write");
    const data = teamSchema.parse(input);
    const team = await prisma.team.findFirst({ where: { id: input.id, organizationId: orgId } });
    if (!team) throw new AppError("NOT_FOUND", "Equipe não encontrada.", 404);
    const dup = await prisma.team.findFirst({
      where: { organizationId: orgId, name: data.name.trim(), NOT: { id: team.id } },
    });
    if (dup) throw new AppError("DUPLICATE", "Já existe uma equipe com esse nome.", 409);
    await validateOrgReferences(orgId, {
      members: [data.leadId, ...data.memberIds],
      departments: [data.departmentId],
    });
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
    await logActivity({
      action: "team.updated",
      entity: "team",
      entityId: team.id,
      newData: {
        name: data.name.trim(),
      },
    });
    return ok({});
  });
}

export async function deleteTeam(id: string) {
  return handleAction(async () => {
    const { orgId, membership } = await getContext();
    guardPerm(membership, "teams.delete");
    const team = await prisma.team.findFirst({ where: { id, organizationId: orgId } });
    if (!team) throw new AppError("NOT_FOUND", "Equipe não encontrada.", 404);
    await prisma.team.delete({ where: { id } });
    await logActivity({
      action: "team.deleted",
      entity: "team",
      entityId: id,
      newData: {},
    });
    return ok({});
  });
}

// ------------------------------------------------------------
// COLABORADORES
// ------------------------------------------------------------

export async function addCollaborator(input: unknown) {
  return handleAction(async () => {
    const { orgId, membership } = await getContext();
    guardPerm(membership, "users.write");
    const data = collaboratorSchema.parse(input);
    const email = normalizeEmail(data.email);

    // Verificação hierárquica: quem pode criar qual role
    const role = (
      data.permission && ["OWNER", "ADMIN", "MANAGER", "LEADER", "MEMBER"].includes(data.permission)
        ? data.permission
        : "MEMBER"
    ) as "OWNER" | "ADMIN" | "MANAGER" | "LEADER" | "MEMBER";

    // Impede MANAGER de promover para OWNER
    guardManagerCannotPromoteToOwner(membership);

    // Verifica se o ator pode criar um membro com este role
    if (!canCreateMember(membership, role)) {
      throw new AppError("FORBIDDEN", "Você não pode cadastrar colaboradores com este cargo.", 403);
    }

    let userId: string;
    let createdUser = false;

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
          passwordHash: await hashPassword(randomBytes(24).toString("hex")),
        },
      });
      userId = u.id;
      createdUser = true;
    }

    // Valida referências de organização
    await validateOrgReferences(orgId, {
      members: [data.managerId],
      departments: [data.departmentId],
      teams: [data.teamId],
    });

    // Contagem de OWNERs para proteção do último
    const ownersCount = await prisma.organizationMember.count({
      where: { organizationId: orgId, role: "OWNER" },
    });
    guardLastOwnerProtection(membership, { owners: ownersCount });

    const member = await prisma.organizationMember.create({
      data: {
        organizationId: orgId,
        userId,
        role,
        jobTitle: data.jobTitle || role || null,
        cpf: data.cpf || null,
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

    await logActivity({
      action: "member.created",
      entity: "member",
      entityId: member.id,
      newData: {
        name: data.name,
        role,
        created: createdUser ? "user+member" : "member",
        cpf: data.cpf ? "normalized" : null,
      },
    });
    return { id: member.id, createdUser };
    return ok({});
  });
}
