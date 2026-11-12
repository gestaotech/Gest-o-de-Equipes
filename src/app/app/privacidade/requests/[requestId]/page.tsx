import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppShellData } from "@/server/page-data";
import { requireDataScope } from "@/server/scope";
import { AppShell } from "@/components/app-shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { permits } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { RequestActions } from "./request-actions";

export const metadata: Metadata = { title: "Detalhes da Solicitação LGPD" };

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const app = await getAppShellData();
  const scope = await requireDataScope();

  const canManage = permits(app.org.role, "audit.read") || permits(app.org.role, "settings.write");

  const request = await prisma.lGPDRequest.findFirst({
    where: canManage
      ? { id: requestId, organizationId: scope.orgId }
      : { id: requestId, organizationId: scope.orgId, userId: app.user.id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      requester: { select: { id: true, name: true } },
      handledBy: { select: { id: true, name: true } },
      history: {
        orderBy: { changedAt: "desc" },
        take: 20,
        include: { changedBy: { select: { id: true, name: true } } },
      },
    },
  });

  if (!request) notFound();

  const isOwner = app.org.role === "OWNER";

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <div className="mx-auto w-full max-w-4xl p-4 lg:p-6 space-y-6">
        <div>
          <Link href="/app/privacidade/requests" className="text-sm text-primary hover:underline">
            ← Voltar para solicitações
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-2">
            Solicitação {request.id.slice(-8)}
          </h1>
        </div>

        <div className="grid gap-4 md:grid-cols-2 rounded-lg border border-border p-5">
          <Field label="Titular" value={`${request.user.name} (${request.user.email})`} />
          <Field label="Solicitante" value={request.requester?.name ?? "—"} />
          <Field label="Tipo" value={<Badge variant="outline">{request.type}</Badge>} />
          <Field label="Status" value={<Badge variant="outline">{request.status}</Badge>} />
          <Field label="Base legal" value={request.legalBasis ?? "—"} />
          <Field
            label="Prazo de resposta"
            value={request.responseDeadline ? new Date(request.responseDeadline).toLocaleDateString("pt-BR") : "—"}
          />
          <Field label="Criada em" value={new Date(request.createdAt).toLocaleString("pt-BR")} />
          <Field label="Responsável" value={request.handledBy?.name ?? "—"} />
          <div className="md:col-span-2">
            <Field label="Descrição" value={request.description ?? "—"} />
          </div>
          {request.rejectionReason && (
            <div className="md:col-span-2">
              <Field label="Motivo da recusa" value={request.rejectionReason} />
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border p-5">
          <h2 className="font-semibold text-foreground mb-4">Ações</h2>
          <RequestActions
            requestId={request.id}
            userId={request.userId}
            type={request.type}
            status={request.status}
            canManage={canManage}
            isOwner={isOwner}
          />
        </div>

        <div className="rounded-lg border border-border p-5">
          <h2 className="font-semibold text-foreground mb-4">Histórico</h2>
          {request.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {request.history.map((h) => (
                <li key={h.id} className="flex flex-wrap gap-2 border-b border-border pb-2 last:border-0">
                  <span className="text-muted-foreground">{new Date(h.changedAt).toLocaleString("pt-BR")}</span>
                  <Badge variant="outline">{h.status}</Badge>
                  <span className="text-foreground">{h.changedBy?.name ?? "Sistema"}</span>
                  {h.comment && <span className="text-muted-foreground">— {h.comment}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-sm text-foreground mt-1">{value}</div>
    </div>
  );
}
