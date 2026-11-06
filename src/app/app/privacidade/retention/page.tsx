import type { Metadata } from "next";
import { getAppShellData } from "@/server/page-data";
import { requireDataScope } from "@/server/scope";
import { AppShell } from "@/components/app-shell/app-shell";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Retenção e Descarte" };

export default async function RetentionPage() {
  const app = await getAppShellData();
  const scope = await requireDataScope();

  const policies = await prisma.retentionPolicy.findMany({
    where: { organizationId: scope.orgId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <div className="mx-auto w-full max-w-7xl p-4 lg:p-6">
        <h1 className="text-2xl font-bold text-foreground mb-6">Retenção e Descarte</h1>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="pb-3 font-medium">Tipo de Entidade</th>
                <th className="pb-3 font-medium">Condição</th>
                <th className="pb-3 font-medium">Ação</th>
                <th className="pb-3 font-medium">Retenção (dias)</th>
                <th className="pb-3 font-medium">Base Legal</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {policies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    Nenhuma política de retenção cadastrada.
                  </td>
                </tr>
              ) : (
                policies.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="p-3 text-sm text-foreground">{p.entityType}</td>
                    <td className="p-3 text-sm text-muted-foreground">{p.condition}</td>
                    <td className="p-3 text-sm text-foreground">{p.action}</td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {p.retentionDays}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {p.legalBasis ?? "—"}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        p.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
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
