import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, getActiveOrg, sessionTokenHash } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { maskIp } from "@/lib/user-agent";
import { AppShell } from "@/components/app-shell/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { ProfileClient } from "./client";
import type { UserPreferences } from "@/lib/user-preferences";
import type { RoleName } from "@prisma/client";

export const metadata: Metadata = { title: "Meu perfil" };

const TABS = ["perfil", "seguranca", "preferencias", "sessoes"] as const;

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab = (TABS as readonly string[]).includes(tab ?? "")
    ? (tab as (typeof TABS)[number])
    : "perfil";

  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
  });
  if (!user) redirect("/login");

  const org = await getActiveOrg(session);

  if (!org) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="items-start">
            <Logo />
            <CardTitle className="mt-4">Crie uma organização</CardTitle>
            <CardDescription>
              Seu perfil pessoal fica disponível após criar ou entrar em uma
              organização.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/criar-org"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-blue-700"
            >
              Criar organização
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [preferences, sessions, orgs, unread, membership] = await Promise.all([
    prisma.userPreference.findUnique({ where: { userId: user.id } }),
    prisma.userSession.findMany({
      where: { userId: user.id },
      orderBy: { lastActiveAt: "desc" },
    }),
    prisma.organizationMember.findMany({
      where: { userId: user.id },
      include: { organization: { select: { id: true, name: true, slug: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.notification.count({
      where: { organizationId: org.id, userId: user.id, readAt: null },
    }),
    prisma.organizationMember.findUnique({
      where: { id: org.membership.id },
      include: {
        department: { select: { name: true } },
        manager: { include: { user: { select: { name: true } } } },
        teamMembers: { include: { team: { select: { name: true } } } },
      },
    }),
  ]);

  const currentHash = session.sid ? sessionTokenHash(session.sid) : null;

  return (
    <AppShell
      org={{ id: org.id, name: org.name, slug: org.slug, role: org.role }}
      orgs={orgs.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role as RoleName,
      }))}
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      }}
      unread={unread}
    >
      <ProfileClient
        initialTab={initialTab}
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
        }}
        preferences={
          preferences
            ? ({
                theme: preferences.theme as UserPreferences["theme"],
                locale: preferences.locale,
                timezone: preferences.timezone,
                taskNotifications: preferences.taskNotifications,
                projectNotifications: preferences.projectNotifications,
                goalNotifications: preferences.goalNotifications,
                announcementNotifications: preferences.announcementNotifications,
              } satisfies UserPreferences)
            : null
        }
        sessions={sessions.map((s) => ({
          id: s.id,
          browser: s.browser,
          device: s.device,
          os: s.os,
          ip: maskIp(s.ipAddress),
          lastActiveAt: s.lastActiveAt.toISOString(),
          createdAt: s.createdAt.toISOString(),
          current: Boolean(currentHash && s.tokenHash === currentHash),
        }))}
        professional={
          membership
            ? {
                role: membership.role as RoleName,
                status: membership.status,
                jobTitle: membership.jobTitle,
                department: membership.department?.name ?? null,
                teams: membership.teamMembers.map((tm) => tm.team.name),
                manager: membership.manager?.user.name ?? null,
                entryDate: (membership.entryDate ?? membership.joinedAt).toISOString(),
              }
            : null
        }
        orgName={org.name}
        isOwner={membership?.role === "OWNER"}
        blocked={membership?.status === "INATIVO"}
      />
    </AppShell>
  );
}
