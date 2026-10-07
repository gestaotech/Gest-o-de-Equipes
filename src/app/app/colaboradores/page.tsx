import type { Metadata } from "next";
import { getAppShellData } from "@/server/page-data";
import { prisma } from "@/lib/prisma";
import { permits, RoleName } from "@/lib/rbac";
import { AppShell } from "@/components/app-shell/app-shell";
import { TeammatesClient } from "./client";
import { requireDataScope } from "@/server/scope";
import { visibleMembersWhere, seesOrg } from "@/server/scope/rules";

export const metadata: Metadata = { title: "Colaboradores" };

function getAllowedRoles(userRole: RoleName): { label: string; value: string }[] {
  // OWNER: pode qualquer role
  if (userRole === "OWNER") {
    return [
      { label: "Proprietário", value: "OWNER" },
      { label: "Administrador", value: "ADMIN" },
      { label: "Gerente", value: "MANAGER" },
      { label: "Líder", value: "LEADER" },
      { label: "Membro", value: "MEMBER" },
    ];
  }
  // MANAGER: pode qualquer exceto OWNER
  if (userRole === "MANAGER") {
    return [
      { label: "Administrador", value: "ADMIN" },
      { label: "Gerente", value: "MANAGER" },
      { label: "Líder", value: "LEADER" },
      { label: "Membro", value: "MEMBER" },
    ];
  }
  // LEADER e MEMBER: ninguêm
  return [];
}

export default async function ColaboradoresPage() {
  const app = await getAppShellData();
  const scope = await requireDataScope();
  const allowedRoles = getAllowedRoles(app.org.role);
  const memberWhere = visibleMembersWhere(scope);

  const [members, teams, departments, managers] = await Promise.all([
    prisma.organizationMember.findMany({
      where: memberWhere,
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        department: { select: { id: true, name: true } },
        manager: { include: { user: { select: { name: true } } } },
        teamMembers: { include: { team: { select: { id: true, name: true } } } },
      },
      orderBy: [{ status: "asc" }, { joinedAt: "asc" }],
    }),
    prisma.team.findMany({
      where: seesOrg(scope)
        ? { organizationId: scope.orgId, archivedAt: null }
        : { organizationId: scope.orgId, archivedAt: null, id: { in: scope.teamIds } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where: seesOrg(scope)
        ? { organizationId: scope.orgId, archivedAt: null }
        : { organizationId: scope.orgId, archivedAt: null, members: { some: { id: scope.memberId } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.organizationMember.findMany({
      where: memberWhere,
      select: {
        id: true,
        user: { select: { name: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <TeammatesClient
        members={members.map((m) => ({
          id: m.id,
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
          status: m.status,
          jobTitle: m.jobTitle,
          phone: m.phone,
          entryDate: m.entryDate,
          departmentId: m.departmentId,
          teamIds: m.teamMembers.map((t) => t.team.id),
          managerId: m.managerId,
          managerName: m.manager?.user?.name ?? null,
        }))}
        selfMemberId={app.membershipId}
        canWrite={permits(app.org.role, "users.write")}
        canDelete={permits(app.org.role, "users.delete")}
        allowedRoles={allowedRoles}
        teams={teams}
        departments={departments}
        managers={managers}
      />
    </AppShell>
  );
}