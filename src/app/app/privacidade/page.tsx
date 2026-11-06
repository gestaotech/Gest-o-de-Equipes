import type { Metadata } from "next";
import { getAppShellData } from "@/server/page-data";
import { requireDataScope } from "@/server/scope";
import { AppShell } from "@/components/app-shell/app-shell";
import { permits } from "@/lib/rbac";
import { Download, FileText, CheckCircle2, AlertTriangle, Clock, Users } from "lucide-react";

export const metadata: Metadata = { title: "Privacidade e Proteção de Dados" };

export default async function PrivacidadePage() {
  const app = await getAppShellData();
  const scope = await requireDataScope();

  const canManage = permits(app.org.role, "audit.read") || permits(app.org.role, "settings.write");

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <div className="mx-auto w-full max-w-7xl p-4 lg:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Privacidade e Proteção de Dados</h1>
          <p className="text-muted-foreground">
            Gerencie solicitações de titulares, políticas de privacidade, retenção de dados e
            incidentes de segurança da organização.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Solicitações de Titulares */}
          <Card
            title="Solicitações de Titulares"
            description="Acesso, correção, exportação, anonimização e eliminação de dados"
            icon={<Users className="h-5 w-5" />}
            href="/app/privacidade/requests"
            canAccess={canManage}
          />

          {/* Exportação de Dados Pessoais */}
          <Card
            title="Exportar Meus Dados"
            description="Baixe uma cópia de todos os seus dados pessoais da organização"
            icon={<Download className="h-5 w-5" />}
            href="/app/privacidade/export"
            canAccess={true}
          />

          {/* Política de Privacidade */}
          <Card
            title="Política de Privacidade"
            description="Versão vigente, histórico e registro de ciência"
            icon={<FileText className="h-5 w-5" />}
            href="/app/privacidade/policy"
            canAccess={canManage}
          />

          {/* Consentimento */}
          <Card
            title="Meu Consentimento"
            description="Versão da política aceita e data do aceite"
            icon={<CheckCircle2 className="h-5 w-5" />}
            href="/app/privacidade/consent"
            canAccess={true}
          />

          {/* Incidentes de Segurança */}
          <Card
            title="Incidentes de Segurança"
            description="Registro e acompanhamento de incidentes"
            icon={<AlertTriangle className="h-5 w-5" />}
            href="/app/privacidade/incidents"
            canAccess={canManage}
          />

          {/* Retenção de Dados */}
          <Card
            title="Retenção e Descarte"
            description="Políticas de retenção por tipo de dado"
            icon={<Clock className="h-5 w-5" />}
            href="/app/privacidade/retention"
            canAccess={canManage}
          />
        </div>

        {!canManage && (
          <div className="mt-6 p-4 rounded-lg border border-yellow-200 bg-yellow-50">
            <h3 className="font-semibold text-yellow-900">Acesso Restrito</h3>
            <p className="text-yellow-800">
              Algumas funcionalidades desta área requerem permissão de auditoria ou configurações.
              Entre em contato com o proprietário da organização.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Card({
  title,
  description,
  icon,
  href,
  canAccess,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  canAccess: boolean;
}) {
  return (
    <CardElement title={title} description={description} icon={icon} href={href} canAccess={canAccess} />
  );
}

function CardElement({
  title,
  description,
  icon,
  href,
  canAccess,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  canAccess: boolean;
}) {
  return (
    <a
      href={href}
      className={`block p-5 rounded-xl border transition ${
        canAccess
          ? "border-border hover:border-primary hover:bg-muted"
          : "border-yellow-100 bg-yellow-50/50 text-muted-foreground cursor-not-allowed"
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-md ${
          canAccess ? "bg-primary/10 text-primary" : "bg-yellow-100 text-yellow-500"
        }`}>
          {icon}
        </div>
      </div>
      <h3 className="font-medium text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
      {canAccess && (
        <span className="mt-3 inline-block text-xs font-medium text-primary hover:underline">
          Abrir →
        </span>
      )}
    </a>
  );
}
