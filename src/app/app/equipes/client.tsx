"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, UsersRound, Check } from "lucide-react";
import { createTeam, updateTeam, deleteTeam } from "@/server/people-actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/types";

type Team = {
  id: string;
  name: string;
  description: string | null;
  departmentId: string | null;
  departmentName: string | null;
  leadId: string | null;
  leadName: string | null;
  memberIds: string[];
  memberNames: string[];
  projects: number;
  tasks: number;
};

type Member = { id: string; user: { id: string; name: string; email: string } };
type Sel = { id: string; name: string };

type Form = {
  name: string;
  description: string;
  departmentId: string;
  leadId: string;
  memberIds: string[];
};

export function TeamsClient({
  teams,
  departments,
  members,
  canWrite,
  canDelete,
}: {
  teams: Team[];
  departments: Sel[];
  members: Member[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ mode: "add" | "edit"; id?: string; form: Form } | null>(null);
  const [deleting, setDeleting] = useState<Team | null>(null);
  const [busy, setBusy] = useState(false);

  const emptyForm: Form = { name: "", description: "", departmentId: "", leadId: "", memberIds: [] };

  async function submit() {
    if (!dialog) return;
    setBusy(true);
    const f = dialog.form;
    const payload = {
      name: f.name,
      description: f.description || null,
      departmentId: f.departmentId || null,
      leadId: f.leadId || null,
      memberIds: f.memberIds,
    };
    const res =
      (dialog.mode === "add" ? await createTeam(payload) : await updateTeam({ id: dialog.id!, ...payload })) as ActionResult;
    setBusy(false);
    if (res.success) {
      toast(dialog.mode === "add" ? "Equipe criada." : "Equipe atualizada.");
      setDialog(null);
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const res = (await deleteTeam(deleting.id)) as ActionResult;
    setBusy(false);
    if (res.success) {
      toast("Equipe removida.");
      setDeleting(null);
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  function toggleMember(id: string) {
    setDialog((d) => {
      if (!d) return d;
      const has = d.form.memberIds.includes(id);
      return {
        ...d,
        form: {
          ...d.form,
          memberIds: has ? d.form.memberIds.filter((m) => m !== id) : [...d.form.memberIds, id],
        },
      };
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Equipes"
        description="Monte grupos de trabalho e atribua um líder."
        actions={
          canWrite && (
            <Button onClick={() => setDialog({ mode: "add", form: emptyForm })}>
              <Plus className="h-4 w-4" /> Nova equipe
            </Button>
          )
        }
      />

      {teams.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="h-6 w-6" />}
          title="Nenhuma equipe"
          description="Crie a primeira equipe para agrupar colaboradores por projeto ou objetivo."
          action={
            canWrite ? (
              <Button onClick={() => setDialog({ mode: "add", form: emptyForm })}>
                <Plus className="h-4 w-4" /> Criar equipe
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <Card key={t.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <UsersRound className="h-5 w-5" />
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
                                  id: t.id,
                                  form: {
                                    name: t.name,
                                    description: t.description ?? "",
                                    departmentId: t.departmentId ?? "",
                                    leadId: t.leadId ?? "",
                                    memberIds: t.memberIds,
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
                              onClick: () => setDeleting(t),
                            },
                          ]
                        : []),
                    ]}
                  />
                )}
              </div>
              <h3 className="mt-3 font-semibold">{t.name}</h3>
              {t.departmentName && (
                <Badge variant="secondary" className="mt-1">{t.departmentName}</Badge>
              )}
              <p className="mt-1 line-clamp-2 min-h-[2rem] text-sm text-muted-foreground">
                {t.description || "Sem descrição."}
              </p>
              {t.leadName && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Líder: <span className="font-medium text-foreground">{t.leadName}</span>
                </p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {t.memberNames.slice(0, 5).map((n, i) => (
                    <Avatar key={i} name={n} className="h-7 w-7 border-2 border-card text-[10px]" />
                  ))}
                  {t.memberNames.length > 5 && (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium">
                      +{t.memberNames.length - 5}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{t.memberIds.length} membros</span>
              </div>
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                <span>{t.projects} projetos</span>
                <span>{t.tasks} tarefas</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(dialog)}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.mode === "add" ? "Nova equipe" : "Editar equipe"}
        description="Defina o nome, o líder e os membros."
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
            <Input
              value={dialog?.form.name}
              onChange={(e) =>
                setDialog((d) => (d ? { ...d, form: { ...d.form, name: e.target.value } } : d))
              }
              placeholder="Ex.: Comercial"
            />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={dialog?.form.description}
              onChange={(e) =>
                setDialog((d) => (d ? { ...d, form: { ...d.form, description: e.target.value } } : d))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Departamento</Label>
              <Select
                value={dialog?.form.departmentId}
                onChange={(e) =>
                  setDialog((d) => (d ? { ...d, form: { ...d.form, departmentId: e.target.value } } : d))
                }
              >
                <option value="">Nenhum</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Líder</Label>
              <Select
                value={dialog?.form.leadId}
                onChange={(e) =>
                  setDialog((d) => (d ? { ...d, form: { ...d.form, leadId: e.target.value } } : d))
                }
              >
                <option value="">Nenhum</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.user.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label>Membros</Label>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
              {members.length === 0 && (
                <p className="p-2 text-sm text-muted-foreground">Nenhum colaborador para adicionar.</p>
              )}
              {members.map((m) => {
                const active = dialog?.form.memberIds.includes(m.id) ?? false;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                      active && "bg-blue-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border",
                        active ? "border-blue-600 bg-blue-600 text-white" : "border-input"
                      )}
                    >
                      {active && <Check className="h-3 w-3" />}
                    </span>
                    <span className="flex-1 truncate">{m.user.name}</span>
                    {active && <span className="text-xs text-blue-600">Selecionado</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remover equipe"
        description={
          deleting
            ? `Remover a equipe "${deleting.name}"? Projetos e tarefas vinculados ficarão sem equipe.`
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