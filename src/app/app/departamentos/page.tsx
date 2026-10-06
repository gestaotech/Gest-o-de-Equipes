import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAppShellData } from "@/server/page-data";
import { prisma } from "@/lib/prisma";
import { permits } from "@/lib/rbac";
import { departmentVisibilityWhere, getPageDataScope } from "@/server/scope";
import { AppShell } from "@/components/app-shell/app-shell";
import { DepartmentsClient } from "./client";

export const metadata: Metadata = { title: "Departamentos" };

export default async function DepartamentosPage() {
  const app = await getAppShellData();

  // Data Scope: MEMBER só enxerga o próprio departamento (não a lista da org).
  const scope = await getPageDataScope(redirect);

  const departments = await prisma.department.findMany({
    where: { ...departmentVisibilityWhere(scope), archivedAt: null },
    include: {
      _count: {
        select: { members: true, teams: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <DepartmentsClient
        departments={departments}
        canWrite={permits(app.org.role, "departments.write")}
        canDelete={permits(app.org.role, "departments.delete")}
      />
    </AppShell>
  );
}