"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Building2, Users } from "lucide-react";
import { createDepartment, updateDepartment, deleteDepartment } from "@/server/people-actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Dropdown } from "@/components/ui/dropdown";
import { toast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/types";

type Dept = {
  id: string;
  name: string;
  description: string | null;
  _count: { members: number; teams: number };
};

export function DepartmentsClient({
  departments,
  canWrite,
  canDelete,
}: {
  departments: Dept[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ mode: "add" | "edit"; name: string; description: string; id?: string } | null>(null);
  const [deleting, setDeleting] = useState<Dept | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!dialog) return;
    setBusy(true);
    const payload = { name: dialog.name, description: dialog.description || null };
    const res =
      (dialog.mode === "add"
        ? await createDepartment(payload)
        : await updateDepartment({ id: dialog.id!, ...payload })) as ActionResult;
    setBusy(false);
    if (res.success) {
      toast(dialog.mode === "add" ? "Departamento criado." : "Departamento atualizado.");
      setDialog(null);
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const res = (await deleteDepartment(deleting.id)) as ActionResult;
    setBusy(false);
    if (res.success) {
      toast("Departamento removido.");
      setDeleting(null);
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Departamentos"
        description="Organize seus colaboradores por áreas."
        actions={
          canWrite && (
            <Button onClick={() => setDialog({ mode: "add", name: "", description: "" })}>
              <Plus className="h-4 w-4" /> Novo departamento
            </Button>
          )
        }
      />

      {departments.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="Nenhum departamento"
          description="Departamentos agrupam colaboradores por área da empresa."
          action={
            canWrite ? (
              <Button onClick={() => setDialog({ mode: "add", name: "", description: "" })}>
                <Plus className="h-4 w-4" /> Criar primeiro departamento
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => (
            <Card key={d.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Building2 className="h-5 w-5" />
                </div>
                {(canWrite || canDelete) && (
                  <Dropdown
                    trigger={<Button variant="ghost" size="sm">•••</Button>}
                    items={[
                      ...(canWrite
                        ? [
                            {
                              label: "Editar",
                              icon: <Pencil className="h-4 w-4" />,
                              onClick: () =>
                                setDialog({ mode: "edit", id: d.id, name: d.name, description: d.description ?? "" }),
                            },
                          ]
                        : []),
                      ...(canDelete
                        ? [
                            {
                              label: "Remover",
                              icon: <Trash2 className="h-4 w-4" />,
                              danger: true,
                              onClick: () => setDeleting(d),
                            },
                          ]
                        : []),
                    ]}
                  />
                )}
              </div>
              <h3 className="mt-3 font-semibold">{d.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {d.description || "Sem descrição."}
              </p>
              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {d._count.members} colaboradores
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(dialog)}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.mode === "add" ? "Novo departamento" : "Editar departamento"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={submit} loading={busy}>Salvar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={dialog?.name} onChange={(e) => setDialog(d => d ? { ...d, name: e.target.value } : d)} placeholder="Ex.: Operações" />
          </div>
          <div>
            <Label>Descrição (opcional)</Label>
            <Textarea value={dialog?.description} onChange={(e) => setDialog(d => d ? { ...d, description: e.target.value } : d)} placeholder="Responsável por..." />
          </div>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remover departamento"
        description={
          deleting
            ? `Remover "${deleting.name}"? Colaboradores e equipes ficarão sem departamento.`
            : ""
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete} loading={busy}>
              <Trash2 className="h-4 w-4" /> Remover
            </Button>
          </>
        }
      />
    </div>
  );
}