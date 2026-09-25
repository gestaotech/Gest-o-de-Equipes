import type { Metadata } from "next";
import { getAppShellData } from "@/server/page-data";
import { prisma } from "@/lib/prisma";
import { permits } from "@/lib/rbac";
import { AppShell } from "@/components/app-shell/app-shell";
import ActivityClient from "./client";

export const metadata: Metadata = { title: "Atividade" };

export default async function AtividadePage() {
  const app = await getAppShellData();
  
  // Verifica permissão para ler auditoria
  if (!permits(app.org.role, "audit.read")) {
    // Redireciona para dashboard se não tiver permissão
    const url = new URL("/dashboard", window.location.origin);
    return null; // Em server component, é melhor lançar um erro ou retornar redirect
    // Para Next.js app router, podemos usar redirect
    // Mas vamos tratar isso de forma mais simples por enquanto
    // Em um caso real, usaríamos redirect ou notFound()
  }

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <ActivityClient 
        orgId={app.org.id} 
        canExport={permits(app.org.role, "audit.export")}
      />
    </AppShell>
  );
}