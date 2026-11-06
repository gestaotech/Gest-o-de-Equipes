import type { Metadata } from "next";
import { getAppShellData } from "@/server/page-data";
import { requireDataScope } from "@/server/scope";
import { AppShell } from "@/components/app-shell/app-shell";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Política de Privacidade" };

export default async function PolicyPage() {
  const app = await getAppShellData();
  const scope = await requireDataScope();

  const policies = await prisma.privacyPolicy.findMany({
    where: { organizationId: scope.orgId },
    orderBy: { createdAt: "desc" },
  });

  const activePolicy = policies.find((p) => p.isActive);

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <div className="mx-auto w-full max-w-4xl p-4 lg:p-6">
        <h1 className="text-2xl font-bold text-foreground mb-6">Política de Privacidade</h1>

        {activePolicy ? (
          <div className="bg-background border rounded-lg p-6 mb-6">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs font-medium text-primary">
                Versão {activePolicy.version}
              </span>
              <span className="text-xs text-muted-foreground">
                Vigência desde{" "}
                {new Date(activePolicy.effectiveFrom).toLocaleDateString("pt-BR")}
              </span>
              {activePolicy.effectiveTo && (
                <span className="text-xs text-muted-foreground">
                  até{" "}
                  {new Date(activePolicy.effectiveTo).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
            <div className="prose prose-sm text-muted-foreground max-w-none">
              {activePolicy.content.split("\n").map((p, i) => (
                <p key={i} className="mb-3">
                  {p}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 mb-6">
            <h3 className="font-semibold text-yellow-900">Nenhuma política vigente</h3>
            <p className="text-yellow-800">
              A organização ainda não possui uma política de privacidade publicada.
            </p>
          </div>
        )}

        <h3 className="text-lg font-semibold text-foreground mb-3">
          Histórico de Versões
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="pb-3 font-medium">Versão</th>
                <th className="pb-3 font-medium">Título</th>
                <th className="pb-3 font-medium">Vigência</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {policies.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    Nenhuma política cadastrada.
                  </td>
                </tr>
              ) : (
                policies.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="p-3 font-mono text-xs">{p.version}</td>
                    <td className="p-3 text-sm text-foreground">{p.title}</td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {new Date(p.effectiveFrom).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        p.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {p.isActive ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
