import { prisma } from "@/lib/prisma";
import { requireSessionApi } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { hasRole, permits } from "@/lib/rbac";
import type { OrganizationMember, RoleName } from "@prisma/client";

export type ActionContext = {
  session: Awaited<ReturnType<typeof requireSessionApi>>;
  orgId: string;
  membership: OrganizationMember;
};

export async function getContext(): Promise<ActionContext> {
  const session = await requireSessionApi();
  if (!session.orgId) {
    throw new AppError("NO_ORG", "Você ainda não possui uma organização.", 404);
  }
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.sub, organizationId: session.orgId },
  });
  if (!membership) {
    throw new AppError("FORBIDDEN", "Acesso negado.", 403);
  }
  return { session, orgId: session.orgId, membership };
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