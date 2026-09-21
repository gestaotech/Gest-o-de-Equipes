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
  if (ROLE_ORDER[membership.role] < ROLE_ORDER[targetRole]) {
    throw new AppError("FORBIDDEN", "Você não pode conceder um papel maior que o seu.", 403);
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

  const checks: Promise<number>[] = [];
  if (members.length) {
    checks.push(
      prisma.organizationMember.count({
        where: { id: { in: members }, organizationId: orgId },
      })
    );
  }
  if (departments.length) {
    checks.push(
      prisma.department.count({
        where: { id: { in: departments }, organizationId: orgId },
      })
    );
  }
  if (teams.length) {
    checks.push(
      prisma.team.count({ where: { id: { in: teams }, organizationId: orgId } })
    );
  }
  if (projects.length) {
    checks.push(
      prisma.project.count({
        where: { id: { in: projects }, organizationId: orgId },
      })
    );
  }
  const counts = await Promise.all(checks);
  const expected = [members.length, departments.length, teams.length, projects.length];
  if (counts.some((c, i) => c !== expected[i])) {
    throw new AppError("INVALID_REF", "Um dos vínculos informados é inválido.", 400);
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