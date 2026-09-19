import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, getActiveOrg } from "@/lib/auth";
import { Logo } from "@/components/ui/logo";
import { OnboardingWizard } from "@/components/org/onboarding-wizard";

export const metadata: Metadata = { title: "Configuração" };

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const org = await getActiveOrg(session);
  if (!org) redirect("/criar-org");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 via-background to-background px-4 py-10">
      <div className="mb-6">
        <Logo />
      </div>
      <OnboardingWizard companyName={org.name} />
    </div>
  );
}