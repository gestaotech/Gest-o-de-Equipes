"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { createLGPDRequest } from "@/server/lgpd-actions";
import type { ActionResult } from "@/lib/types";

const REQUEST_TYPES = [
  { value: "ACCESS", label: "Confirmação e acesso aos dados" },
  { value: "CORRECTION", label: "Correção de dados incompletos/desatualizados" },
  { value: "ANONYMIZATION", label: "Anonimização, bloqueio ou eliminação" },
  { value: "PORTABILITY", label: "Portabilidade dos dados" },
  { value: "DELETION", label: "Eliminação de dados" },
  { value: "REVOCATION", label: "Revogação de consentimento" },
  { value: "OPPOSITION", label: "Oposição ao tratamento" },
  { value: "OTHER", label: "Outra solicitação" },
];

const LEGAL_BASES = [
  { value: "", label: "Selecione uma base legal" },
  { value: "CONSENT", label: "Consentimento do titular" },
  { value: "LEGAL_OBLIGATION", label: "Cumprimento de obrigação legal" },
  { value: "CONTRACT", label: "Execução de contrato" },
  { value: "LEGITIMATE_INTEREST", label: "Interesse legítimo" },
  { value: "LEGAL_EXERCISE", label: "Exercício regular de direitos" },
  { value: "OTHER", label: "Outra" },
];

export type MemberOption = { userId: string; name: string; email: string };

export function NewRequestForm({
  members,
  currentUserId,
  canChooseOwner,
}: {
  members: MemberOption[];
  currentUserId: string;
  canChooseOwner: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState(currentUserId);
  const [type, setType] = useState("ACCESS");
  const [description, setDescription] = useState("");
  const [legalBasis, setLegalBasis] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (description.trim().length < 10) {
      toast("Descreva a solicitação com pelo menos 10 caracteres.", "error");
      return;
    }
    setBusy(true);
    const res = (await createLGPDRequest({
      userId,
      type,
      description: description.trim(),
      legalBasis: legalBasis || undefined,
    })) as ActionResult<{ request: { id: string } }>;
    setBusy(false);

    if (res.success && res.data) {
      toast("Solicitação criada. Prazo legal: 15 dias.");
      router.push(`/app/privacidade/requests/${res.data.request.id}`);
    } else {
      toast(res.error?.message ?? "Erro ao criar a solicitação.", "error");
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Titular dos dados</label>
        <select
          className="w-full border rounded-lg p-2 text-sm"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          disabled={!canChooseOwner}
        >
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name} ({m.email})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          {canChooseOwner
            ? "Selecione o titular dos dados. Por padrão, é o usuário logado."
            : "Você só pode abrir solicitações sobre os seus próprios dados."}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Tipo de solicitação *</label>
        <select className="w-full border rounded-lg p-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
          {REQUEST_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Descrição *</label>
        <textarea
          className="w-full border rounded-lg p-2 text-sm"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descreva detalhadamente o que você está solicitando..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Base legal (opcional)</label>
        <select className="w-full border rounded-lg p-2 text-sm" value={legalBasis} onChange={(e) => setLegalBasis(e.target.value)}>
          {LEGAL_BASES.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          Se não souber, deixe em branco. A organização poderá definir posteriormente.
        </p>
      </div>

      <div className="pt-4 flex items-center gap-3">
        <Button type="submit" loading={busy}>
          Criar solicitação
        </Button>
        <Link href="/app/privacidade/requests" className="text-muted-foreground hover:underline">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
