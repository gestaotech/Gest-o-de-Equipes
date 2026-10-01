import "server-only";
import { prisma } from "@/lib/prisma";
import { requireSessionApi, getActiveOrg } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { hasRole, permits, ROLE_ORDER } from "@/lib/rbac";
import type { OrganizationMember, RoleName } from "@prisma/client";

export type ActionContext = {
  session: Awaited<ReturnType<typeof requireSessionApi>>;
  orgId: string;
  membership: OrganizationMember;
};

/**
 * Contexto de uma server action: sessão + organização ATIVA.
 *
 * A organização ativa é resolvida pelo cookie `tf_org` (getActiveOrg),
 * que é a mesma fonte usada pelas páginas (AppShell). Isso garante que
 * trocar de organização no seletor também muda o alvo das ações.
 * Nunca confia no `orgId` gravado no JWT (pode estar defasado).
 */
export async function getContext(): Promise<ActionContext> {
  const session = await requireSessionApi();
  const org = await getActiveOrg(session);
  if (!org) throw new AppError("NO_ORG", "Você ainda não possui uma organização.", 404);
  if (org.membership.status !== "ATIVO") {
    throw new AppError("FORBIDDEN", "Seu acesso a esta organização está desativado.", 403);
  }
  return { session, orgId: org.id, membership: org.membership };
}

export function guardRole(
  membership: OrganizationMember,
  min: RoleName
): void {
  if (!hasRole(membership.role, min)) {
    throw new AppError("FORBIDDEN", "Sem permissão para esta ação.", 403);
  }
}

export function guardPerm(
  membership: OrganizationMember,
  permission: string
): void {
  if (!permits(membership.role, permission)) {
    throw new AppError("FORBIDDEN", "Sem permissão para esta ação.", 403);
  }
}

/** Impede conceder um papel maior ou igual ao próprio (exceto OWNER). */
export function guardCanAssign(
  membership: OrganizationMember,
  targetRole: RoleName
): void {
  if (membership.role === "OWNER") return;
  if (ROLE_ORDER[membership.role] <= ROLE_ORDER[targetRole]) {
    throw new AppError("FORBIDDEN", "Você não pode conceder um papel maior ou igual ao seu.", 403);
  }
}

/**
 * Valida que TODAS as referências informadas pelo cliente pertencem à organização.
 * Previne cross-tenant por associação (vincular membro/equipe/projeto de outra org).
 */
export async function validateOrgReferences(
  orgId: string,
  refs: {
    members?: (string | null | undefined)[];
    departments?: (string | null | undefined)[];
    teams?: (string | null | undefined)[];
    projects?: (string | null | undefined)[];
  }
): Promise<void> {
  const clean = (arr?: (string | null | undefined)[]) =>
    Array.from(new Set((arr ?? []).filter(Boolean) as string[]));
  const members = clean(refs.members);
  const departments = clean(refs.departments);
  const teams = clean(refs.teams);
  const projects = clean(refs.projects);

  const [foundMembers, foundDepartments, foundTeams, foundProjects] = await Promise.all([
    members.length
      ? prisma.organizationMember.findMany({
          where: { id: { in: members }, organizationId: orgId },
          select: { id: true },
        })
      : [],
    departments.length
      ? prisma.department.findMany({
          where: { id: { in: departments }, organizationId: orgId },
          select: { id: true },
        })
      : [],
    teams.length
      ? prisma.team.findMany({ where: { id: { in: teams }, organizationId: orgId }, select: { id: true } })
      : [],
    projects.length
      ? prisma.project.findMany({
          where: { id: { in: projects }, organizationId: orgId },
          select: { id: true },
        })
      : [],
  ]);

  const invalid = (ids: string[], found: { id: string }[], label: string) => {
    const missing = ids.filter((id) => !found.some((f) => f.id === id));
    return missing.length ? `${label}(s) não pertence(m) a esta organização: ${missing.join(", ")}` : "";
  };
  const problems = [
    invalid(members, foundMembers, "Membro"),
    invalid(departments, foundDepartments, "Departamento"),
    invalid(teams, foundTeams, "Equipe"),
    invalid(projects, foundProjects, "Projeto"),
  ].filter(Boolean);
  if (problems.length) {
    throw new AppError("INVALID_REF", `Vínculo inválido: ${problems.join("; ")}`, 400);
  }
}

/** Verifica se o ator pode criar um membro com o papel informado. */
export function canCreateMember(actorMembership: OrganizationMember, targetRole: RoleName): boolean {
  const actorRole = actorMembership.role;
  // OWNER pode criar qualquer um
  if (actorRole === "OWNER") return true;
  // MANAGER pode criar exceto OWNER
  if (actorRole === "MANAGER") return targetRole !== "OWNER";
  // LEADER e MEMBER não podem criar ninguém
  return false;
}

/** Verifica se o ator pode alterar o papel de um membro. */
export function canChangeMemberRole(actorMembership: OrganizationMember, targetRole: RoleName): boolean {
  const actorRole = actorMembership.role;
  // OWNER pode mudar qualquer um para qualquer role
  if (actorRole === "OWNER") return true;
  // MANAGER pode mudar exceto para OWNER
  if (actorRole === "MANAGER") return targetRole !== "OWNER";
  // LEADER e MEMBER não podem mudar role
  return false;
}

/** Verifica se o ator pode desativar um membro. */
export function canDeactivateMember(actorMembership: OrganizationMember, targetMembership: OrganizationMember): boolean {
  const actorRole = actorMembership.role;
  const targetRole = targetMembership.role;
  // OWNER pode desativar qualquer um
  if (actorRole === "OWNER") return true;
  // MANAGER pode desativar exceto OWNER
  if (actorRole === "MANAGER") return targetRole !== "OWNER";
  // LEADER e MEMBER não podem desativar
  return false;
}

/** Verifica se o ator pode remover um membro. */
export function canRemoveMember(actorMembership: OrganizationMember, targetMembership: OrganizationMember): boolean {
  const actorRole = actorMembership.role;
  const targetRole = targetMembership.role;
  // OWNER pode remover qualquer um
  if (actorRole === "OWNER") return true;
  // MANAGER pode remover exceto OWNER
  if (actorRole === "MANAGER") return targetRole !== "OWNER";
  // LEADER e MEMBER não podem remover
  return false;
}

/** Verifica se pode remover o último OWNER (validated no servidor). */
export function canRemoveLastOwner(actorMembership: OrganizationMember, orgMemberCount: { owners: number }): boolean {
  if (actorMembership.role !== "OWNER") return false;
  return orgMemberCount.owners > 1;
}

/** Impede que o último OWNER seja removido ou rebaixado. */
export function guardLastOwnerProtection(
  membership: OrganizationMember,
  orgMemberCount: { owners: number }
): void {
  if (membership.role === "OWNER" && orgMemberCount.owners <= 1) {
    throw new AppError("LAST_OWNER", "A organização precisa de ao menos um proprietário.", 403);
  }
}

/** Impede promoção para OWNER por MANAGER. */
export function guardManagerCannotPromoteToOwner(membership: OrganizationMember): void {
  if (membership.role === "MANAGER") {
    throw new AppError("FORBIDDEN", "Gerentes não podem cadastrar ou promover proprietários.", 403);
  }
}

export async function getOrgMembers(orgId: string) {
  return prisma.organizationMember.findMany({
    where: { organizationId: orgId },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      department: { select: { id: true, name: true } },
      manager: { include: { user: { select: { name: true } } } },
      teamMembers: { include: { team: { select: { id: true, name: true } } } },
    },
    orderBy: [{ status: "asc" }, { joinedAt: "asc" }],
  });
}