import type { Metadata } from "next";
import { getAppShellData } from "@/server/page-data";
import { requireDataScope } from "@/server/scope";
import { AppShell } from "@/components/app-shell/app-shell";
import { ExportButton } from "./export-button";

export const metadata: Metadata = { title: "Exportar Meus Dados" };

export default async function ExportPage() {
  const app = await getAppShellData();
  await requireDataScope();

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <div className="mx-auto w-full max-w-3xl p-4 lg:p-6">
        <h1 className="text-2xl font-bold text-foreground mb-6">Exportar Meus Dados</h1>

        <div className="bg-muted rounded-lg p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Portabilidade de Dados Pessoais
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Baixe uma cópia de todos os seus dados pessoais tratados pela organização
            &quot;{app.org.name}&quot;. Os dados são gerados na hora, em formato JSON estruturado.
          </p>

          <div className="bg-background border rounded p-4 mb-4">
            <h3 className="font-medium text-foreground mb-2">O que está incluído:</h3>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Dados cadastrais (nome, e-mail, telefone)</li>
              <li>Vínculo com a organização (cargo, departamento, data de entrada)</li>
              <li>Sessões de autenticação (datas, IP e dispositivo)</li>
              <li>Notificações recebidas</li>
              <li>Comentários em tarefas</li>
              <li>Registros de atividade (auditoria)</li>
            </ul>
          </div>

          <div className="pt-4">
            <ExportButton userId={app.user.id} orgSlug={app.org.slug} />
            <p className="text-xs text-muted-foreground mt-2">
              O arquivo é gerado no seu navegador a partir dos dados da sua conta. Ele contém
              dados pessoais: guarde-o em local seguro.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
