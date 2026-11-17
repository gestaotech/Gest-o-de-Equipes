import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, getActiveOrg } from "@/lib/auth";
import { getPlanByTier, formatPrice } from "@/lib/plans";
import { CheckoutButton } from "@/components/billing/checkout-button";

export const metadata: Metadata = { title: "Contratar plano" };

type Props = { searchParams: Promise<{ plan?: string }> };

export default async function CheckoutPage({ searchParams }: Props) {
  const params = await searchParams;
  const tier = params.plan === "ANUAL" ? "ANUAL" : params.plan === "MENSAL" ? "MENSAL" : null;
  if (!tier) redirect("/#planos");

  const session = await getSession();
  if (!session) redirect(`/cadastro?plan=${tier}`);

  const organization = await getActiveOrg(session);
  if (!organization) redirect(`/criar-org?plan=${tier}`);

  const plan = getPlanByTier(tier);
  if (!plan) redirect("/#planos");
  const price = formatPrice(plan);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl border bg-card p-8 shadow-sm">
        <p className="text-sm font-semibold text-blue-600">Finalizar contratação</p>
        <h1 className="mt-2 text-2xl font-bold">Plano {plan.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Empresa: {organization.name}</p>
        <div className="my-6">
          <span className="text-3xl font-bold">{price.price}</span>
          <span className="ml-2 text-sm text-muted-foreground">{price.period}</span>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          Você será direcionado ao ambiente seguro do Asaas para escolher a forma de pagamento e concluir a assinatura.
        </p>
        <CheckoutButton tier={tier} />
        <Link href="/#planos" className="mt-5 block text-center text-sm text-muted-foreground hover:text-foreground">Voltar aos planos</Link>
      </section>
    </main>
  );
}
