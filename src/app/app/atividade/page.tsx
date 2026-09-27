import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAppShellData } from "@/server/page-data";
import { permits } from "@/lib/rbac";
import { AppShell } from "@/components/app-shell/app-shell";
import ActivityClient from "./client";

export const metadata: Metadata = { title: "Atividade" };

export default async function AtividadePage() {
  const app = await getAppShellData();

  // Verifica permissão para ler auditoria
  if (!permits(app.org.role, "audit.read")) {
    redirect("/dashboard");
  }

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <ActivityClient canExport={permits(app.org.role, "audit.export")} />
    </AppShell>
  );
}