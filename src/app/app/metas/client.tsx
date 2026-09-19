"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Target } from "lucide-react";
import { createGoal, updateGoal, deleteGoal } from "@/server/work-actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Badge, statusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown } from "@/components/ui/dropdown";
import { formatDate } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

type Goal = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  responsibleId: string | null;
  responsibleName: string | null;
  teamId: string | null;
  teamName: string | null;
  startValue: number;
  targetValue: number;
  progress: number;
  dueDate: Date | null;
  memberIds: string[];
  memberNames: string[];
};

type Member = { id: string; user: { name: string } };
type Sel = { id: string; name: string };

type Form = {
  title: string;
  description: string;
  status: string;
  responsibleId: string;
  teamId: string;
  startValue: string;
  targetValue: string;
  dueDate: string;
};

const emptyForm: Form = {
  title: "",
  description: "",
  status: "EM_ANDAMENTO",
  responsibleId: "",
  teamId: "",
  startValue: "0",
  targetValue: "100",
  dueDate: "",
};

export function GoalsClient({
  goals,
  teams,
  members,
  canWrite,
  canDelete,
}: {
  goals: Goal[];
  teams: Sel[];
  members: Member[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ mode: "add" | "edit"; id?: string; form: Form } | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!dialog) return;
    setBusy(true);
    const f = dialog.form;
    const payload = {
      title: f.title,
      description: f.description || null,
      status: f.status,
      responsibleId: f.responsibleId || null,
      teamId: f.teamId || null,
      startValue: Number(f.startValue) || 0,
      targetValue: Number(f.targetValue) || 100,
      dueDate: f.dueDate || null,
    };
    const res: any =
      dialog.mode === "add" ? await createGoal(payload) : await updateGoal({ id: dialog.id!, ...payload });
    setBusy(false);
    if (res.success) {
      toast(dialog.mode === "add" ? "Meta criada." : "Meta atualizada.");
      setDialog(null);
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const res: any = await deleteGoal(deleting.id);
    setBusy(false);
    if (res.success) {
      toast("Meta removida.");
      setDeleting(null);
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Metas"
        description="Acompanhe os objetivos do time."
        actions={
          canWrite && (
            <Button onClick={() => setDialog({ mode: "add", form: emptyForm })}>
              <Plus className="h-4 w-4" /> Nova meta
            </Button>
          )
        }
      />
      {goals.length === 0 ? (
        <EmptyState
          icon={<Target className="h-6 w-6" />}
          title="Nenhuma meta"
          description="Defina objetivos com metas mensuráveis para o time."
          action={
            canWrite ? (
              <Button onClick={() => setDialog({ mode: "add", form: emptyForm })}>
                <Plus className="h-4 w-4" /> Criar meta
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((g) => (
            <Card key={g.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Target className="h-5 w-5" />
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
                                setDialog({
                                  mode: "edit",
                                  id: g.id,
                                  form: {
                                    title: g.title,
                                    description: g.description ?? "",
                                    status: g.status,
                                    responsibleId: g.responsibleId ?? "",
                                    teamId: g.teamId ?? "",
                                    startValue: String(g.startValue),
                                    targetValue: String(g.targetValue),
                                    dueDate: g.dueDate ? g.dueDate.toISOString().slice(0, 10) : "",
                                  },
                                }),
                            },
                          ]
                        : []),
                      ...(canDelete
                        ? [
                            {
                              label: "Remover",
                              icon: <Trash2 className="h-4 w-4" />,
                              danger: true,
                              onClick: () => setDeleting(g),
                            },
                          ]
                        : []),
                    ]}
                  />
                )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <h3 className="flex-1 font-semibold">{g.title}</h3>
                {statusBadge(g.status)}
              </div>
              {g.teamName && <Badge variant="secondary" className="mt-1">{g.teamName}</Badge>}
              <p className="mt-1 line-clamp-2 min-h-[2rem] text-sm text-muted-foreground">
                {g.description || "Sem descrição."}
              </p>
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {g.startValue} / {g.targetValue}
                  </span>
                  <span className="font-semibold text-blue-600">{g.progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${g.progress}%` }}
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{g.responsibleName ? `Responsável: ${g.responsibleName}` : "Sem responsável"}</span>
                <span>{formatDate(g.dueDate)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(dialog)}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.mode === "add" ? "Nova meta" : "Editar meta"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={submit} loading={busy}>Salvar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={dialog?.form.title} onChange={(e) => setDialog((d) => d ? { ...d, form: { ...d.form, title: e.target.value } } : d)} placeholder="Ex.: Atingir R$ 100 mil em vendas" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={dialog?.form.description} onChange={(e) => setDialog((d) => d ? { ...d, form: { ...d.form, description: e.target.value } } : d)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor atual</Label>
              <Input type="number" value={dialog?.form.startValue} onChange={(e) => setDialog((d) => d ? { ...d, form: { ...d.form, startValue: e.target.value } } : d)} />
            </div>
            <div>
              <Label>Meta (valor alvo)</Label>
              <Input type="number" value={dialog?.form.targetValue} onChange={(e) => setDialog((d) => d ? { ...d, form: { ...d.form, targetValue: e.target.value } } : d)} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={dialog?.form.status} onChange={(e) => setDialog((d) => d ? { ...d, form: { ...d.form, status: e.target.value } } : d)}>
                <option value="PLANEJAMENTO">Planejamento</option>
                <option value="EM_ANDAMENTO">Em andamento</option>
                <option value="CONCLUIDO">Concluído</option>
              </Select>
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={dialog?.form.dueDate} onChange={(e) => setDialog((d) => d ? { ...d, form: { ...d.form, dueDate: e.target.value } } : d)} />
            </div>
            <div>
              <Label>Responsável</Label>
              <Select value={dialog?.form.responsibleId} onChange={(e) => setDialog((d) => d ? { ...d, form: { ...d.form, responsibleId: e.target.value } } : d)}>
                <option value="">Nenhum</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.user.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Equipe</Label>
              <Select value={dialog?.form.teamId} onChange={(e) => setDialog((d) => d ? { ...d, form: { ...d.form, teamId: e.target.value } } : d)}>
                <option value="">Nenhuma</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remover meta"
        description={deleting ? `Remover a meta "${deleting.title}"?` : ""}
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