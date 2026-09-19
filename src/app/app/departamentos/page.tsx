import type { Metadata } from "next";
import { getAppShellData } from "@/server/page-data";
import { prisma } from "@/lib/prisma";
import { permits } from "@/lib/rbac";
import { AppShell } from "@/components/app-shell/app-shell";
import { DepartmentsClient } from "./client";

export const metadata: Metadata = { title: "Departamentos" };

export default async function DepartamentosPage() {
  const app = await getAppShellData();
  const departments = await prisma.department.findMany({
    where: { organizationId: app.org.id, archivedAt: null },
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