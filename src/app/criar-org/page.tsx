import type { Metadata } from "next";
import { getSession, getActiveOrg } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CreateOrgForm } from "@/components/org/create-org-form";

export const metadata: Metadata = { title: "Criar empresa" };

export default async function CreateOrgPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const org = await getActiveOrg(session);
  if (org) redirect("/dashboard");

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-background to-background px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <CreateOrgForm />
      </div>
    </div>
  );
}