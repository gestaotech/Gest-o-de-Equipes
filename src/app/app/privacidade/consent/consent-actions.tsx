"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { grantConsent, revokeConsent } from "@/server/governance-actions";
import type { ActionResult } from "@/lib/types";

export function ConsentActions({ policyId, accepted }: { policyId: string; accepted: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    const res = (await grantConsent({ policyId })) as ActionResult;
    setBusy(false);
    if (res.success) {
      toast("Consentimento registrado.");
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro ao registrar o consentimento.", "error");
    }
  }

  async function revoke() {
    if (!window.confirm("Revogar seu consentimento para esta política?")) return;
    setBusy(true);
    const res = (await revokeConsent(policyId)) as ActionResult;
    setBusy(false);
    if (res.success) {
      toast("Consentimento revogado.");
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro ao revogar o consentimento.", "error");
    }
  }

  if (accepted) {
    return (
      <Button variant="outline" onClick={revoke} loading={busy} className="mt-4">
        Revogar Consentimento
      </Button>
    );
  }

  return (
    <Button onClick={accept} loading={busy}>
      Aceitar Política de Privacidade
    </Button>
  );
}
