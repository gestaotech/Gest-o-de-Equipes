import type { Metadata } from "next";
import Link from "next/link";
import { getSession, getActiveOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Confirmação da contratação" };

type Props = { searchParams: Promise<{ status?: string }> };

export default async function CheckoutReturnPage({ searchParams }: Props) {
  const params = await searchParams;
  const session = await getSession();
  const org = session ? await getActiveOrg(session) : null;
  const subscription = org
    ? await prisma.subscription.findUnique({ where: { organizationId: org.id }, select: { status: true } })
    : null;
  const confirmed = subscription?.status === "ACTIVE";
  const canceled = params.status === "canceled" || params.status === "expired";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold">{confirmed ? "Assinatura confirmada" : canceled ? "Contratação não concluída" : "Aguardando confirmação do pagamento"}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {confirmed
            ? "O Asaas confirmou o pagamento e seu plano está ativo."
            : canceled
              ? "O checkout foi cancelado ou expirou. Você pode retornar aos planos e tentar novamente."
              : "Recebemos seu retorno do Asaas. A liberação do plano depende da confirmação enviada pelo webhook de pagamento; esta página não ativa a assinatura por conta própria."}
        </p>
        {confirmed ? (
          <Link href="/dashboard" className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white">Acessar dashboard</Link>
        ) : (
          <Link href="/#planos" className="mt-6 inline-flex rounded-lg border px-5 py-3 text-sm font-medium">Voltar aos planos</Link>
        )}
      </section>
    </main>
  );
}
