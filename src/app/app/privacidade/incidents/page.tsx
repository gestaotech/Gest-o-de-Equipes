import type { Metadata } from "next";
import { getAppShellData } from "@/server/page-data";
import { requireDataScope } from "@/server/scope";
import { AppShell } from "@/components/app-shell/app-shell";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Incidentes de Segurança" };

export default async function IncidentsPage() {
  const app = await getAppShellData();
  const scope = await requireDataScope();

  const incidents = await prisma.securityIncident.findMany({
    where: { organizationId: scope.orgId },
    include: {
      responsible: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <div className="mx-auto w-full max-w-7xl p-4 lg:p-6">
        <h1 className="text-2xl font-bold text-foreground mb-6">Incidentes de Segurança</h1>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="pb-3 font-medium">Título</th>
                <th className="pb-3 font-medium">Categoria</th>
                <th className="pb-3 font-medium">Severidade</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Titulares</th>
                <th className="pb-3 font-medium">Responsável</th>
                <th className="pb-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    Nenhum incidente registrado.
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => (
                  <tr key={inc.id} className="border-b border-border last:border-0">
                    <td className="p-3 text-sm text-foreground">{inc.title}</td>
                    <td className="p-3 text-sm text-muted-foreground">{inc.category}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        inc.severity === "CRITICAL"
                          ? "bg-red-100 text-red-700"
                          : inc.severity === "HIGH"
                          ? "bg-orange-100 text-orange-700"
                          : inc.severity === "MEDIUM"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-green-100 text-green-700"
                      }`}>
                        {inc.severity}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        inc.status === "RESOLVED"
                          ? "bg-green-100 text-green-700"
                          : inc.status === "OPEN"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {inc.status}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {inc.subjectsAffected ?? 0}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {inc.responsible?.name ?? "—"}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {new Date(inc.createdAt).toLocaleDateString("pt-BR")}
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
