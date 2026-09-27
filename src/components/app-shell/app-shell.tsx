"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  UsersRound,
  FolderKanban,
  ListTodo,
  Target,
  Calendar,
  Megaphone,
  Settings,
  BarChart3,
  FileBarChart2,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronsUpDown,
  SwitchCamera,
  Plus,
  UserRound,
} from "lucide-react";
import type { RoleName } from "@prisma/client";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown } from "@/components/ui/dropdown";
import { toast } from "@/components/ui/toast";
import { switchOrganization } from "@/server/org-actions";
import { logout } from "@/server/auth-actions";
import { permits, ROLE_LABEL } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/types";

export type ShellOrg = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group?: string;
  perm?: string;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/colaboradores", label: "Colaboradores", icon: Users },
  { href: "/app/departamentos", label: "Departamentos", icon: Building2 },
  { href: "/app/equipes", label: "Equipes", icon: UsersRound },
  { href: "/app/projetos", label: "Projetos", icon: FolderKanban },
  { href: "/app/tarefas", label: "Tarefas", icon: ListTodo },
  { href: "/app/metas", label: "Metas", icon: Target },
  { href: "/app/agenda", label: "Agenda", icon: Calendar },
  { href: "/app/avisos", label: "Avisos", icon: Megaphone },
  { href: "/app/notificacoes", label: "Notificações", icon: Bell },
  { href: "/app/atividade", label: "Atividade", icon: FileBarChart2, group: "Acompanhamento", perm: "audit.read" },
  { href: "/app/indicadores", label: "Indicadores", icon: BarChart3, group: "Acompanhamento", perm: "indicators.read" },
  { href: "/app/relatorios", label: "Relatórios", icon: FileBarChart2, group: "Acompanhamento", perm: "reports.read" },
  { href: "/app/configuracoes", label: "Configurações", icon: Settings },
];

export function AppShell({
  org,
  orgs,
  user,
  unread,
  children,
}: {
  org: ShellOrg;
  orgs: ShellOrg[];
  user: { id: string; name: string; email: string; avatarUrl?: string | null };
  unread: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  async function doSwitch(id: string) {
    const res = (await switchOrganization(id)) as ActionResult;
    if (res.success) {
      toast("Organização alterada.");
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  async function doLogout() {
    await logout();
    toast("Até logo!");
    setTimeout(() => {
      router.push("/login");
      router.refresh();
    }, 150);
  }

  const visibleNav = NAV.filter((n) => !n.perm || permits(org.role as RoleName, n.perm));

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 px-3">
      {visibleNav.map((item, index) => {
        const showGroup =
          item.group &&
          item.group !== visibleNav[index - 1]?.group;
        return (
          <React.Fragment key={item.href}>
            {showGroup ? (
              <div className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {item.group}
              </div>
            ) : null}
            <Link
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-blue-50 text-blue-700"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          </React.Fragment>
        );
      })}
    </nav>
  );

  const sidebarFooter = (
    <div className="border-t p-3">
      <Dropdown
        align="left"
        trigger={
          <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-accent">
            <Avatar name={user.name} src={user.avatarUrl ?? undefined} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </span>
          </button>
        }
        items={[
          {
            label: "Meu perfil",
            icon: <UserRound className="h-4 w-4" />,
            onClick: () => {
              router.push("/profile");
            },
          },
          {
            label: "Minhas configurações",
            icon: <Settings className="h-4 w-4" />,
            onClick: () => {
              router.push("/app/configuracoes");
            },
          },
          {
            label: "Sair",
            icon: <LogOut className="h-4 w-4" />,
            danger: true,
            onClick: doLogout,
          },
        ]}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card lg:flex">
        <div className="flex h-16 items-center border-b px-4">
          <Logo />
        </div>
        <div className="border-b p-3">
          <Dropdown
            align="left"
            trigger={
              <button className="flex w-full items-center gap-3 rounded-lg border bg-background px-3 py-2 text-left hover:bg-accent">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{org.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {ROLE_LABEL[org.role as RoleName] ?? org.role} · {org.slug}
                  </span>
                </span>
                <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
              </button>
            }
            items={[
              ...orgs
                .filter((o) => o.id !== org.id)
                .map((o) => ({
                  label: `${o.name} (${o.slug})`,
                  icon: <SwitchCamera className="h-4 w-4" />,
                  onClick: () => doSwitch(o.id),
                })),
              ...[
                {
                  label: "Criar organização",
                  icon: <Plus className="h-4 w-4" />,
                  onClick: () => router.push("/criar-org"),
                },
              ],
            ]}
          />
        </div>
        {nav}
        {sidebarFooter}
      </aside>

      {/* Sidebar mobile */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r bg-card">
            <div className="flex h-16 items-center justify-between border-b px-4">
              <Logo />
              <button onClick={() => setOpen(false)} aria-label="Fechar menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="border-b p-3">
              <div className="rounded-lg border bg-background px-3 py-2">
                <span className="block text-sm font-semibold">{org.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {ROLE_LABEL[org.role as RoleName] ?? org.role} · {org.slug}
                </span>
              </div>
            </div>
            {nav}
            {sidebarFooter}
          </aside>
        </div>
      )}

      {/* Cabeçalho */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:pl-64">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            className="rounded-md p-2 hover:bg-accent lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium text-muted-foreground">
            {pathname === "/profile"
              ? "Meu perfil"
              : NAV.find((n) => isActive(n.href))?.label ?? "TeamFlow"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/notificacoes"
            className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Notificações"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
          <Dropdown
            align="right"
            trigger={
              <button className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-accent">
                <Avatar
                  name={user.name}
                  src={user.avatarUrl ?? undefined}
                  className="h-8 w-8"
                />
              </button>
            }
            items={[
              {
                label: "Meu perfil",
                icon: <UserRound className="h-4 w-4" />,
                onClick: () => router.push("/profile"),
              },
              {
                label: "Minhas configurações",
                icon: <Settings className="h-4 w-4" />,
                onClick: () => router.push("/app/configuracoes"),
              },
              {
                label: "Sair",
                icon: <LogOut className="h-4 w-4" />,
                danger: true,
                onClick: doLogout,
              },
            ]}
          />
        </div>
      </header>

      <main className="px-4 py-6 pb-24 lg:pl-64 lg:pr-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}