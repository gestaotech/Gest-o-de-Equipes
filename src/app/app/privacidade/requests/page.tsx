import type { Metadata } from "next";
import { getAppShellData } from "@/server/page-data";
import { requireDataScope } from "@/server/scope";
import { AppShell } from "@/components/app-shell/app-shell";
import { permits } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Solicitações de Titulares" };

export default async function RequestsPage() {
  const app = await getAppShellData();
  const scope = await requireDataScope();

  const canManage = permits(app.org.role, "audit.read") || permits(app.org.role, "settings.write");
  const isOwn = !canManage;

  const where = canManage
    ? { organizationId: scope.orgId }
    : { organizationId: scope.orgId, userId: app.user.id };

  const requests = await prisma.lGPDRequest.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      requester: { select: { id: true, name: true, email: true } },
      handledBy: { select: { id: true, name: true, email: true } },
      history: {
        orderBy: { changedAt: "desc" },
        take: 3,
        include: { changedBy: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <div className="mx-auto w-full max-w-7xl p-4 lg:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Solicitações de Titulares</h1>
            <p className="text-muted-foreground">
              Gerencie solicitações de acesso, correção, exportação, anonimização e eliminação
              de dados pessoais da organização.
            </p>
          </div>
          {canManage && (
            <a href="/app/privacidade/requests/new" className="btn-primary">
              Nova Solicitação
            </a>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="pb-3 font-medium">ID</th>
                <th className="pb-3 font-medium">Titular</th>
                <th className="pb-3 font-medium">Tipo</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Solicitante</th>
                <th className="pb-3 font-medium">Prazo</th>
                <th className="pb-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    Nenhuma solicitação encontrada.
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="border-b border-border last:border-0">
                    <td className="p-3 font-mono text-xs">{req.id.slice(-8)}</td>
                    <td className="p-3">
                      <div className="font-medium text-foreground">{req.user.name}</div>
                      <div className="text-xs text-muted-foreground">{req.user.email}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">
                        {req.type}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={statusVariant(req.status)} className="text-xs">
                        {req.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {req.requester ? (
                        <div className="text-sm text-foreground">{req.requester.name}</div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {req.responseDeadline ? (
                        <div className="text-sm font-medium text-foreground">
                          {new Date(req.responseDeadline).toLocaleDateString("pt-BR")}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <a
                        href={`/app/privacidade/requests/${req.id}`}
                        className="text-primary hover:underline text-xs"
                      >
                        Ver detalhes
                      </a>
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

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "COMPLETED":
      return "default";
    case "REJECTED":
      return "destructive";
    case "IN_PROGRESS":
      return "secondary";
    case "PENDING":
    default:
      return "outline";
  }
}

import { Badge } from "@/components/ui/badge";
