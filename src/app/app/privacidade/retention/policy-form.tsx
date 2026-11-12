"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { createRetentionPolicy } from "@/server/governance-actions";
import { MIN_RETENTION_DAYS } from "@/lib/retention";
import type { ActionResult } from "@/lib/types";

const ENTITY_OPTIONS = [
  { value: "activity_logs", label: "Registros de atividade (auditoria)" },
  { value: "notifications", label: "Notificações já lidas" },
];

export function RetentionPolicyForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [entityType, setEntityType] = useState(ENTITY_OPTIONS[0].value);
  const [retentionDays, setRetentionDays] = useState(365);
  const [legalBasis, setLegalBasis] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = (await createRetentionPolicy({
      entityType,
      condition: "Registros mais antigos que o prazo de retenção",
      action: "DELETE",
      retentionDays,
      legalBasis: legalBasis.trim() || undefined,
      isActive: true,
    })) as ActionResult;
    setBusy(false);

    if (res.success) {
      toast("Política criada. Ela será aplicada na próxima execução diária.");
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro ao criar a política.", "error");
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-4 rounded-lg border border-border p-5 md:grid-cols-2">
      <h2 className="md:col-span-2 font-semibold text-foreground">Nova política de retenção</h2>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Tipo de dado</label>
        <select className="w-full border rounded-lg p-2 text-sm" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          {ENTITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Retenção (dias)</label>
        <input
          type="number"
          min={MIN_RETENTION_DAYS}
          className="w-full border rounded-lg p-2 text-sm"
          value={retentionDays}
          onChange={(e) => setRetentionDays(Number(e.target.value))}
        />
        <p className="text-xs text-muted-foreground mt-1">Mínimo de {MIN_RETENTION_DAYS} dias.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Base legal (opcional)</label>
        <input
          className="w-full border rounded-lg p-2 text-sm"
          value={legalBasis}
          onChange={(e) => setLegalBasis(e.target.value)}
          placeholder="Ex.: Obrigação legal de auditoria"
        />
      </div>

      <div className="md:col-span-2 flex items-center gap-3">
        <Button type="submit" loading={busy}>
          Criar política
        </Button>
        <p className="text-xs text-muted-foreground">
          Ação aplicada: excluir. A execução roda todos os dias (03:00 UTC).
        </p>
      </div>
    </form>
  );
}
