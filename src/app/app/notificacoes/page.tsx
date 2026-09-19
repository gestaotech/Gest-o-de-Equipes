import type { Metadata } from "next";
import { getAppShellData } from "@/server/page-data";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell/app-shell";
import { NotificationsClient } from "./client";

export const metadata: Metadata = { title: "Notificações" };

export default async function NotificacoesPage() {
  const app = await getAppShellData();
  const notifications = await prisma.notification.findMany({
    where: { organizationId: app.org.id, userId: app.session.sub },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <NotificationsClient
        initialUnread={unread}
        notifications={notifications}
      />
    </AppShell>
  );
}