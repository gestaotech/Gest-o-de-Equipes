import type { Metadata } from "next";
import { Suspense } from "react";
import { FirstAccessForm } from "@/components/auth/first-access-form";

export const metadata: Metadata = { title: "Primeiro acesso" };

export default function FirstAccessPage() {
  return (
    <Suspense fallback={<div className="py-6 text-center text-sm text-muted-foreground">Carregando...</div>}>
      <FirstAccessForm />
    </Suspense>
  );
}
