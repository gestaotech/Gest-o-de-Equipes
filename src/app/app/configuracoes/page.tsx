import type { Metadata } from "next";
import { getAppShellData } from "@/server/page-data";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/rbac";
import { AppShell } from "@/components/app-shell/app-shell";
import { SettingsClient } from "./client";

export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const app = await getAppShellData();
  const [orgInfo, subscription, members] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: app.org.id },
      select: { id: true, name: true, segment: true, size: true, slug: true, createdAt: true },
    }),
    prisma.subscription.findFirst({
      where: { organizationId: app.org.id },
      include: { plan: true },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: app.org.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  const canManageMembers = hasRole(app.org.role, "ADMIN");

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <SettingsClient
        org={{
          id: orgInfo?.id ?? "",
          name: orgInfo?.name ?? "",
          segment: orgInfo?.segment ?? "",
          size: orgInfo?.size ?? "",
          slug: orgInfo?.slug ?? "",
        }}
        user={app.user}
        plan={
          subscription?.plan
            ? {
                name: subscription.plan.name,
                tier: subscription.plan.tier,
                priceMonthly: subscription.plan.priceMonthly,
                maxUsers: subscription.plan.maxUsers,
              }
            : null
        }
        members={members.map((m) => ({
          id: m.id,
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
          jobTitle: m.jobTitle,
        }))}
        selfUserId={app.session.sub}
        canManageMembers={canManageMembers}
        memberCount={members.length}
      />
    </AppShell>
  );
}