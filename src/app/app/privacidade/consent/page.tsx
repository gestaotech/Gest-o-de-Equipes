import type { Metadata } from "next";
import { getAppShellData } from "@/server/page-data";
import { requireDataScope } from "@/server/scope";
import { AppShell } from "@/components/app-shell/app-shell";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Meu Consentimento" };

export default async function ConsentPage() {
  const app = await getAppShellData();
  const scope = await requireDataScope();

  const activePolicy = await prisma.privacyPolicy.findFirst({
    where: { organizationId: scope.orgId, isActive: true },
  });

  const consent = activePolicy
    ? await prisma.consent.findFirst({
        where: {
          userId: app.user.id,
          organizationId: scope.orgId,
          policyId: activePolicy.id,
        },
      })
    : null;

  return (
    <AppShell org={app.org} orgs={app.orgs} user={app.user} unread={app.unread}>
      <div className="mx-auto w-full max-w-3xl p-4 lg:p-6">
        <h1 className="text-2xl font-bold text-foreground mb-6">Meu Consentimento</h1>

        {activePolicy ? (
          <>
            <div className="bg-background border rounded-lg p-6 mb-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-foreground">
                  {activePolicy.title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Versão {activePolicy.version} •
                  Vigência desde{" "}
                  {new Date(activePolicy.effectiveFrom).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="prose prose-sm text-muted-foreground max-w-none">
                {activePolicy.content.split("\n").map((p, i) => (
                  <p key={i} className="mb-3">{p}</p>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-4">Seu Consentimento</h3>

              {consent ? (
                <>
                  <div className="mb-4">
                    <span className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs">
                      Aceito
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Você aceitou a versão{" "}
                    <span className="font-medium">{consent.version}</span>{" "}
                    em{" "}
                    <span className="font-medium">
                      {new Date(consent.grantedAt).toLocaleDateString("pt-BR")}
                    </span>
                    .
                  </p>
                  <button className="btn-primary mt-4">Revogar Consentimento</button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    Você ainda não aceitou a política de privacidade vigente.
                  </p>
                  <button className="btn-primary">Aceitar Política de Privacidade</button>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
            <h3 className="font-semibold text-yellow-900">Nenhuma política vigente</h3>
            <p className="text-yellow-800">
              A organização não possui uma política de privacidade publicada no momento.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
