import type { Metadata } from "next";
import { getAppShellData } from "@/server/page-data";
import { requireDataScope } from "@/server/scope";
import { AppShell } from "@/components/app-shell/app-shell";

export const metadata: Metadata = { title: "Exportar Meus Dados" };

export default async function ExportPage() {
  const app = await getAppShellData();
  const scope = await requireDataScope();

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <div className="mx-auto w-full max-w-3xl p-4 lg:p-6">
        <h1 className="text-2xl font-bold text-foreground mb-6">Exportar Meus Dados</h1>

        <div className="bg-muted rounded-lg p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Portabilidade de Dados Pessoais
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Solicite uma cópia de todos os seus dados pessoais tratados pela organização
            "{app.org.name}". Os dados serão fornecidos em formato JSON estruturado.
          </p>

          <div className="bg-background border rounded p-4 mb-4">
            <h3 className="font-medium text-foreground mb-2">O que está incluído:</h3>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Dados cadastrais (nome, e-mail, telefone)</li>
              <li>Vínculo com a organização (cargo, departamento, data de entrada)</li>
              <li>Sessões de autenticação (datas, IP mascarado)</li>
              <li>Notificações recebidas</li>
              <li>Comentários em tarefas</li>
              <li>Registros de atividade (auditoria)</li>
            </ul>
          </div>

          <div className="pt-4">
            <button className="btn-primary">Solicitar exportação de dados</button>
            <p className="text-xs text-muted-foreground mt-2">
              A exportação será processada no servidor e o link para download será enviado
              por e-mail. O link expira em 24 horas.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
