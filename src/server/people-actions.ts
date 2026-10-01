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
    const email = data.email ? normalizeEmail(data.email) : null;

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
              randomBytes(24).toString("hex")
            ),
          },
        });
        userId = u.id;
        createdUser = true;
      }
    } else {
      // Sem e-mail: cria usuário de caixa com e-mail derivado (sem login real).
      const base = slugify(data.name.trim()) || "colaborador";
      const u = await prisma.user.create({
        data: {
          name: data.name.trim(),
          email: await uniqueDummyEmail(base),
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

async function uniqueDummyEmail(base: string): Promise<string> {
  const candidate = `${base}@sem-email.teamflow`;
  const exists = await prisma.user.findUnique({ where: { email: candidate } });
  if (!exists) return candidate;
  for (let i = 1; i < 100; i++) {
    const next = `${base}-${i}@sem-email.teamflow`;
    const used = await prisma.user.findUnique({ where: { email: next } });
    if (!used) return next;
  }
  return `${base}-${randomBytes(3).toString("hex")}@sem-email.teamflow`;
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

    // Impede MANAGER de promover para OWNER
    guardManagerCannotPromoteToOwner(membership);

    // Verifica se o ator pode mudar o papel para o target
    if (data.permission && !canChangeMemberRole(membership, role)) {
      throw new AppError("FORBIDDEN", "Você não pode alterar o papel deste colaborador.", 403);
    }

    if (data.permission) {
      guardCanAssign(membership, role);
      if (member.userId === session.sub && role !== member.role) {
        throw new AppError("SELF_ROLE", "Você não pode alterar seu próprio papel por aqui.", 400);
      }
      if (member.role === "OWNER" && role !== "OWNER") {
        if (membership.role !== "OWNER") {
          throw new AppError("FORBIDDEN", "Somente o proprietário pode rebaixar um proprietário.", 403);
        }
        const owners = await prisma.organizationMember.count({
          where: { organizationId: orgId, role: "OWNER" },
        });
        if (owners <= 1) {
          throw new AppError("LAST_OWNER", "A organização precisa de ao menos um proprietário.", 400);
        }
      }
    }

    // Contagem de OWNERs para proteção do último
    const ownersCount = await prisma.organizationMember.count({
      where: { organizationId: orgId, role: "OWNER" },
    });
    guardLastOwnerProtection(membership, { owners: ownersCount });

    await validateOrgReferences(orgId, {
      members: [data.managerId],
      departments: [data.departmentId],
      teams: [data.teamId],
    });

    await prisma.organizationMember.update({
      where: { id: member.id },
      data: {
        role,
        jobTitle: data.jobTitle || role || member.jobTitle,
        cpf: data.cpf || member.cpf,
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
    // Só mexe nas equipes quando o cliente informou teamId de forma explícita
    // (undefined = não alterar; string/null = trocar/remover).
    if (data.teamId !== undefined) {
      await prisma.teamMember.deleteMany({ where: { memberId: member.id } });
      if (data.teamId) {
        await prisma.teamMember.create({
          data: { teamId: data.teamId, memberId: member.id },
        });
      }
    }
    await logActivity({
      action: "member.updated",
      entity: "member",
      entityId: member.id,
      newData: {
        name: data.name,
      },
    });
    return ok({});
  });
}

export async function removeCollaborator(id: string) {
  return handleAction(async () => {
    const { orgId, membership } = await getContext();
    guardPerm(membership, "users.delete");
    const member = await prisma.organizationMember.findFirst({
      where: { id, organizationId: orgId },
      include: { user: { select: { name: true } } },
    });
    if (!member) throw new AppError("NOT_FOUND", "Colaborador não encontrado.", 404);
    if (member.id === membership.id) {
      throw new AppError("SELF_REMOVE", "Você não pode remover a si mesmo.", 400);
    }
    if (membership.role !== "OWNER" && ROLE_ORDER[member.role] >= ROLE_ORDER[membership.role]) {
      throw new AppError("FORBIDDEN", "Você não pode remover um colaborador com papel igual ou superior ao seu.", 403);
    }
    if (member.role === "OWNER") {
      if (membership.role !== "OWNER") {
        throw new AppError("FORBIDDEN", "Somente o proprietário pode remover um proprietário.", 403);
      }
      const owners = await prisma.organizationMember.count({
        where: { organizationId: orgId, role: "OWNER" },
      });
      if (owners <= 1) {
        throw new AppError("LAST_OWNER", "A organização precisa de ao menos um proprietário.", 400);
      }
    }
    await prisma.organizationMember.delete({ where: { id: member.id } });
    await logActivity({
      action: "member.deleted",
      entity: "member",
      entityId: id,
      newData: {
        name: member.user.name,
      },
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
    if (member.userId === session.sub && role !== member.role) {
      throw new AppError("SELF_ROLE", "Altere seu próprio papel pela edição de perfil (apenas por um administrador).", 400);
    }
    // Impede MANAGER de promover para OWNER
    guardManagerCannotPromoteToOwner(membership);
    // Verifica se o ator pode mudar o papel para o target
    if (!canChangeMemberRole(membership, role)) {
      throw new AppError("FORBIDDEN", "Você não pode alterar o papel deste colaborador.", 403);
    }
    guardCanAssign(membership, role);
    if (member.role === "OWNER" && role !== "OWNER") {
      if (membership.role !== "OWNER") {
        throw new AppError("FORBIDDEN", "Somente o proprietário pode rebaixar um proprietário.", 403);
      }
      const owners = await prisma.organizationMember.count({
        where: { organizationId: orgId, role: "OWNER" },
      });
      if (owners <= 1) {
        throw new AppError("LAST_OWNER", "A organização precisa de ao menos um proprietário.", 400);
      }
    }
await prisma.organizationMember.update({
   where: { id: member.id },
   data: { role },
 });
    await logActivity({
      action: "member.role",
      entity: "member",
      entityId: member.id,
      newData: { role },
    });
    return ok({});
  });
}