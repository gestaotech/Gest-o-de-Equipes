"use client";

import { useState, useTransition } from "react";
import { startPlanCheckout } from "@/server/checkout-actions";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/types";

export function CheckoutButton({ tier }: { tier: "MENSAL" | "ANUAL" }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function beginCheckout() {
    setError(null);
    startTransition(async () => {
      const result = await startPlanCheckout({ tier }) as ActionResult<{ checkoutUrl: string }>;
      if (!result.success || !result.data?.checkoutUrl) {
        setError(result.error?.message ?? "Não foi possível iniciar o pagamento.");
        return;
      }
      window.location.assign(result.data.checkoutUrl);
    });
  }

  return (
    <div className="space-y-3">
      <Button type="button" className="w-full" loading={pending} onClick={beginCheckout}>
        {pending ? "Preparando pagamento..." : "Continuar para pagamento"}
      </Button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-muted-foreground">O acesso ao plano contratado será liberado após a confirmação do pagamento pelo Asaas.</p>
    </div>
  );
}
