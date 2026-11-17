import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Criar conta" };

type SignupPageProps = {
  searchParams: Promise<{ plan?: string }>;
};

const VALID_PLANS = ["MENSAL", "ANUAL"] as const;

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const selectedPlan = VALID_PLANS.includes(params.plan as (typeof VALID_PLANS)[number])
    ? params.plan
    : undefined;
  const session = await getSession();

  if (session) {
    redirect(selectedPlan ? `/contratar?plan=${selectedPlan}` : "/criar-org");
  }

  return <SignupForm selectedPlan={selectedPlan} />;
}