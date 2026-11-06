import type { Metadata } from "next";
import { getAppShellData } from "@/server/page-data";
import { requireDataScope } from "@/server/scope";
import { AppShell } from "@/components/app-shell/app-shell";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Nova Solicitação LGPD" };

export default async function NewRequestPage() {
  const app = await getAppShellData();
  const scope = await requireDataScope();

  const members = await prisma.organizationMember.findMany({
    where: { organizationId: scope.orgId, status: "ATIVO" },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { joinedAt: "asc" },
  });

  const requestTypes = [
    { value: "ACCESS", label: "Confirmação e acesso aos dados" },
    { value: "CORRECTION", label: "Correção de dados incompletos/desatualizados" },
    { value: "ANONYMIZATION", label: "Anonimização, bloqueio ou eliminação" },
    { value: "PORTABILITY", label: "Portabilidade dos dados" },
    { value: "DELETION", label: "Eliminação de dados" },
    { value: "REVOCATION", label: "Revogação de consentimento" },
    { value: "OPPOSITION", label: "Oposição ao tratamento" },
    { value: "OTHER", label: "Outra solicitação" },
  ];

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <div className="mx-auto w-full max-w-3xl p-4 lg:p-6">
        <h1 className="text-2xl font-bold text-foreground mb-6">Nova Solicitação</h1>

        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Titular dos dados
            </label>
            <select className="w-full border rounded-lg p-2 text-sm" disabled>
              {members.map((m) => (
                <option key={m.id} value={m.userId}>
                  {m.user.name} ({m.user.email})
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Selecione o titular dos dados. Por padrão, é o usuário logado.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Tipo de solicitação *
            </label>
            <select className="w-full border rounded-lg p-2 text-sm">
              {requestTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Descrição *
            </label>
            <textarea
              className="w-full border rounded-lg p-2 text-sm"
              rows={4}
              placeholder="Descreva detalhadamente o que você está solicitando..."
            ></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Base legal (opcional)
            </label>
            <select className="w-full border rounded-lg p-2 text-sm">
              <option value="">Selecione uma base legal</option>
              <option value="CONSENT">Consentimento do titular</option>
              <option value="LEGAL_OBLIGATION">Cumprimento de obrigação legal</option>
              <option value="CONTRACT">Execução de contrato</option>
              <option value="LEGITIMATE_INTEREST">Interesse legítimo</option>
              <option value="LEGAL_EXERCISE">Exercício regular de direitos</option>
              <option value="OTHER">Outra</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Se não souber, deixe em branco. A organização poderá definir posteriormente.
            </p>
          </div>

          <div className="pt-4">
            <button className="btn-primary">Criar solicitação</button>
            <a href="/app/privacidade/requests" className="text-muted-foreground hover:underline ml-2">
              Cancelar
            </a>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
