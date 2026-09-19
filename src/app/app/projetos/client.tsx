"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, FolderKanban, Check } from "lucide-react";
import { createProject, updateProject, deleteProject } from "@/server/work-actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, statusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown } from "@/components/ui/dropdown";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  startDate: Date | null;
  dueDate: Date | null;
  teamId: string | null;
  teamName: string | null;
  responsibleId: string | null;
  responsibleName: string | null;
  memberIds: string[];
  memberNames: string[];
  tasks: number;
};

type Member = { id: string; user: { name: string } };
type Sel = { id: string; name: string };

type Form = {
  name: string;
  description: string;
  status: string;
  priority: string;
  startDate: string;
  dueDate: string;
  teamId: string;
  responsibleId: string;
  memberIds: string[];
};

const emptyForm: Form = {
  name: "",
  description: "",
  status: "PLANEJAMENTO",
  priority: "MEDIUM",
  startDate: "",
  dueDate: "",
  teamId: "",
  responsibleId: "",
  memberIds: [],
};

export function ProjectsClient({
  projects,
  teams,
  members,
  canWrite,
  canDelete,
}: {
  projects: Project[];
  teams: Sel[];
  members: Member[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ mode: "add" | "edit"; id?: string; form: Form } | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!dialog) return;
    setBusy(true);
    const f = dialog.form;
    const payload = {
      name: f.name,
      description: f.description || null,
      status: f.status,
      priority: f.priority,
      startDate: f.startDate || null,
      dueDate: f.dueDate || null,
      teamId: f.teamId || null,
      responsibleId: f.responsibleId || null,
      memberIds: f.memberIds,
    };
    const res: any =
      dialog.mode === "add" ? await createProject(payload) : await updateProject({ id: dialog.id!, ...payload });
    setBusy(false);
    if (res.success) {
      toast(dialog.mode === "add" ? "Projeto criado." : "Projeto atualizado.");
      setDialog(null);
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const res: any = await deleteProject(deleting.id);
    setBusy(false);
    if (res.success) {
      toast("Projeto removido.");
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
        title="Projetos"
        description="Acompanhe tudo que está em andamento."
        actions={
          canWrite && (
            <Button onClick={() => setDialog({ mode: "add", form: emptyForm })}>
              <Plus className="h-4 w-4" /> Novo projeto
            </Button>
          )
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-6 w-6" />}
          title="Nenhum projeto"
          description="Crie um projeto para agrupar tarefas e acompanhar prazos."
          action={
            canWrite ? (
              <Button onClick={() => setDialog({ mode: "add", form: emptyForm })}>
                <Plus className="h-4 w-4" /> Criar projeto
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projeto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Equipe</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Tarefas</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <p className="font-medium">{p.name}</p>
                    <p className="line-clamp-1 max-w-[260px] text-xs text-muted-foreground">
                      {p.description || ""}
                    </p>
                  </TableCell>
                  <TableCell>{statusBadge(p.status)}</TableCell>
                  <TableCell>{statusBadge(p.priority)}</TableCell>
                  <TableCell className="text-muted-foreground">{p.teamName ?? "—"}</TableCell>
                  <TableCell>
                    {p.responsibleName ? (
                      <span className="flex items-center gap-2">
                        <Avatar name={p.responsibleName} className="h-6 w-6 text-[9px]" />
                        <span className="text-sm">{p.responsibleName}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={p.dueDate && new Date(p.dueDate) < new Date() && p.status !== "CONCLUIDO" ? "text-red-600" : ""}>
                      {formatDate(p.dueDate)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.tasks}</TableCell>
                  <TableCell>
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
                                      id: p.id,
                                      form: {
                                        name: p.name,
                                        description: p.description ?? "",
                                        status: p.status,
                                        priority: p.priority,
                                        startDate: p.startDate ? fmtDate(p.startDate) : "",
                                        dueDate: p.dueDate ? fmtDate(p.dueDate) : "",
                                        teamId: p.teamId ?? "",
                                        responsibleId: p.responsibleId ?? "",
                                        memberIds: p.memberIds,
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
                                  onClick: () => setDeleting(p),
                                },
                              ]
                            : []),
                        ]}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={Boolean(dialog)}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.mode === "add" ? "Novo projeto" : "Editar projeto"}
        description="Planeje o projeto, o time e os responsáveis."
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
            <Input value={dialog?.form.name} onChange={(e) => setDialog((d) => d ? { ...d, form: { ...d.form, name: e.target.value } } : d)} placeholder="Nome do projeto" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={dialog?.form.description} onChange={(e) => setDialog((d) => d ? { ...d, form: { ...d.form, description: e.target.value } } : d)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={dialog?.form.status} onChange={(e) => setDialog((d) => d ? { ...d, form: { ...d.form, status: e.target.value } } : d)}>
                <option value="PLANEJAMENTO">Planejamento</option>
                <option value="EM_ANDAMENTO">Em andamento</option>
                <option value="PAUSADO">Pausado</option>
                <option value="CONCLUIDO">Concluído</option>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={dialog?.form.priority} onChange={(e) => setDialog((d) => d ? { ...d, form: { ...d.form, priority: e.target.value } } : d)}>
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Média</option>
                <option value="HIGH">Alta</option>
                <option value="URGENT">Urgente</option>
              </Select>
            </div>
            <div>
              <Label>Início</Label>
              <Input type="date" value={dialog?.form.startDate} onChange={(e) => setDialog((d) => d ? { ...d, form: { ...d.form, startDate: e.target.value } } : d)} />
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={dialog?.form.dueDate} onChange={(e) => setDialog((d) => d ? { ...d, form: { ...d.form, dueDate: e.target.value } } : d)} />
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
            <div>
              <Label>Responsável</Label>
              <Select value={dialog?.form.responsibleId} onChange={(e) => setDialog((d) => d ? { ...d, form: { ...d.form, responsibleId: e.target.value } } : d)}>
                <option value="">Nenhum</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.user.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label>Membros do projeto</Label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
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
                    {m.user.name}
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
        title="Remover projeto"
        description={deleting ? `Remover o projeto "${deleting.name}"? As tarefas vinculadas também serão removidas.` : ""}
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

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}