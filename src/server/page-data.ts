import "server-only";
import { redirect } from "next/navigation";
import { getSession, getActiveOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleName } from "@prisma/client";

export async function getAppShellData() {
  const session = await getSession();
  if (!session) redirect("/login");
  const org = await getActiveOrg(session);
  if (!org) redirect("/criar-org");

  const [user, orgs, unread] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.sub },
      select: { id: true, name: true, email: true, avatarUrl: true },
    }),
    prisma.organizationMember.findMany({
      where: { userId: session.sub, status: "ATIVO" },
      include: { organization: { select: { id: true, name: true, slug: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.notification.count({
      where: { organizationId: org.id, userId: session.sub, readAt: null },
    }),
  ]);

  if (!user) redirect("/login");

  return {
    session,
    org,
    membershipId: org.membership.id,
    user,
    orgs: orgs.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role as RoleName,
    })),
    unread,
  };
}