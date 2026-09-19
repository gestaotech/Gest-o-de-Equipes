import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetForm } from "@/components/auth/reset-form";

export const metadata: Metadata = { title: "Redefinir senha" };

export default function ResetPage() {
  return (
    <Suspense fallback={<div className="py-6 text-center text-sm text-muted-foreground">Carregando...</div>}>
      <ResetForm />
    </Suspense>
  );
}