import type { Metadata } from "next";
import { getAppShellData } from "@/server/page-data";
import { requireDataScope } from "@/server/scope";
import { AppShell } from "@/components/app-shell/app-shell";
import { permits } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { NewRequestForm } from "./new-request-form";

export const metadata: Metadata = { title: "Nova Solicitação LGPD" };

export default async function NewRequestPage() {
  const app = await getAppShellData();
  const scope = await requireDataScope();

  const canChooseOwner = permits(app.org.role, "audit.read") || permits(app.org.role, "settings.write");

  const members = await prisma.organizationMember.findMany({
    where: { organizationId: scope.orgId, status: "ATIVO" },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { joinedAt: "asc" },
  });

  const options = canChooseOwner
    ? members.map((m) => ({ userId: m.userId, name: m.user.name, email: m.user.email }))
    : members
        .filter((m) => m.userId === app.user.id)
        .map((m) => ({ userId: m.userId, name: m.user.name, email: m.user.email }));

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <div className="mx-auto w-full max-w-3xl p-4 lg:p-6">
        <h1 className="text-2xl font-bold text-foreground mb-6">Nova Solicitação</h1>
        <NewRequestForm members={options} currentUserId={app.user.id} canChooseOwner={canChooseOwner} />
      </div>
    </AppShell>
  );
}
