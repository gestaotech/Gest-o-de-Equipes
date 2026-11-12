"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { updateLGPDRequestStatus, anonymizeUserData, deleteUserData } from "@/server/lgpd-actions";
import type { ActionResult } from "@/lib/types";

const STATUSES = [
  { value: "PENDING", label: "Pendente" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "COMPLETED", label: "Concluída" },
  { value: "REJECTED", label: "Recusada" },
  { value: "CANCELLED", label: "Cancelada" },
];

const FINAL_STATUSES = ["COMPLETED", "REJECTED", "CANCELLED"];

export function RequestActions({
  requestId,
  userId,
  type,
  status,
  canManage,
  isOwner,
}: {
  requestId: string;
  userId: string;
  type: string;
  status: string;
  canManage: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [nextStatus, setNextStatus] = useState(status);
  const [rejectionReason, setRejectionReason] = useState("");

  const isFinal = FINAL_STATUSES.includes(status);

  async function updateStatus(value: string, reason?: string) {
    return (await updateLGPDRequestStatus({
      requestId,
      status: value,
      rejectionReason: reason || undefined,
    })) as ActionResult;
  }

  async function saveStatus() {
    if (nextStatus === "REJECTED" && rejectionReason.trim().length < 5) {
      toast("Informe o motivo da recusa.", "error");
      return;
    }
    setBusy(true);
    const res = await updateStatus(nextStatus, nextStatus === "REJECTED" ? rejectionReason.trim() : undefined);
    setBusy(false);
    if (res.success) {
      toast("Status atualizado.");
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro ao atualizar o status.", "error");
    }
  }

  async function anonymize() {
    if (!window.confirm("Anonimizar os dados deste titular nesta organização? Essa ação não pode ser desfeita.")) return;
    setBusy(true);
    const res = (await anonymizeUserData(userId)) as ActionResult;
    if (!res.success) {
      setBusy(false);
      toast(res.error?.message ?? "Erro ao anonimizar os dados.", "error");
      return;
    }
    const closed = await updateStatus("COMPLETED");
    setBusy(false);
    if (closed.success) {
      toast("Dados anonimizados e solicitação concluída.");
      router.refresh();
    } else {
      toast("Dados anonimizados, mas não foi possível concluir a solicitação.", "error");
    }
  }

  async function remove() {
    if (!window.confirm("Excluir os dados deste titular nesta organização? Essa ação é irreversível.")) return;
    setBusy(true);
    const res = (await deleteUserData(userId)) as ActionResult;
    if (!res.success) {
      setBusy(false);
      toast(res.error?.message ?? "Erro ao excluir os dados.", "error");
      return;
    }
    const closed = await updateStatus("COMPLETED");
    setBusy(false);
    if (closed.success) {
      toast("Dados excluídos e solicitação concluída.");
      router.refresh();
    } else {
      toast("Dados excluídos, mas não foi possível concluir a solicitação.", "error");
    }
  }

  if (!canManage) {
    return <p className="text-sm text-muted-foreground">Somente administradores podem alterar esta solicitação.</p>;
  }

  return (
    <div className="space-y-6">
      {!isFinal && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-foreground">Atualizar status</label>
          <select
            className="w-full border rounded-lg p-2 text-sm"
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {nextStatus === "REJECTED" && (
            <textarea
              className="w-full border rounded-lg p-2 text-sm"
              rows={3}
              placeholder="Motivo da recusa (obrigatório)"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          )}
          <Button onClick={saveStatus} loading={busy} variant="outline">
            Salvar status
          </Button>
        </div>
      )}

      {!isFinal && type === "ANONYMIZATION" && (
        <div className="space-y-2 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-900">
            Anonimiza os dados identificadores do titular nesta organização e conclui a solicitação.
          </p>
          <Button variant="destructive" onClick={anonymize} loading={busy}>
            Anonimizar dados do titular
          </Button>
        </div>
      )}

      {!isFinal && type === "DELETION" && isOwner && (
        <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-900">
            Remove o vínculo do titular com esta organização e apaga os dados vinculados a ela.
          </p>
          <Button variant="destructive" onClick={remove} loading={busy}>
            Excluir dados do titular
          </Button>
        </div>
      )}
    </div>
  );
}
