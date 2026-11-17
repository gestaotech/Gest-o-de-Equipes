import type { Metadata } from "next";
import { getSession, getActiveOrg } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CreateOrgForm } from "@/components/org/create-org-form";

export const metadata: Metadata = { title: "Criar empresa" };

type CreateOrgPageProps = {
  searchParams: Promise<{ plan?: string }>;
};

const VALID_PLANS = ["MENSAL", "ANUAL"] as const;

export default async function CreateOrgPage({ searchParams }: CreateOrgPageProps) {
  const params = await searchParams;
  const selectedPlan = VALID_PLANS.includes(params.plan as (typeof VALID_PLANS)[number])
    ? params.plan
    : undefined;
  const session = await getSession();
  if (!session) redirect(selectedPlan ? `/cadastro?plan=${selectedPlan}` : "/login");
  const org = await getActiveOrg(session);
  if (org) redirect(selectedPlan ? `/contratar?plan=${selectedPlan}` : "/dashboard");

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-background to-background px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <CreateOrgForm selectedPlan={selectedPlan} />
      </div>
    </div>
  );
}