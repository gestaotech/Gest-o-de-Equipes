"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { exportUserData } from "@/server/lgpd-actions";
import type { ActionResult } from "@/lib/types";

export function ExportButton({ userId, orgSlug }: { userId: string; orgSlug: string }) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    const res = (await exportUserData(userId)) as ActionResult<{ data: unknown }>;
    setBusy(false);

    if (!res.success || !res.data) {
      toast(res.error?.message ?? "Não foi possível gerar a exportação.", "error");
      return;
    }

    const blob = new Blob([JSON.stringify(res.data.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meus-dados-${orgSlug}-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast("Exportação gerada.");
  }

  return (
    <Button onClick={download} loading={busy}>
      Baixar meus dados (JSON)
    </Button>
  );
}
