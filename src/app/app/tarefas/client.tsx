"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  ListTodo,
  Check,
  CalendarClock,
  Flag,
} from "lucide-react";
import {
  createTask,
  updateTask,
  deleteTask,
  setTaskStatus,
  createComment,
} from "@/server/work-actions";
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
import { cn, formatDate, formatDateTime, isPastDue } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

type Assignee = { id: string; name: string; userId: string };
type Comment = { id: string; text: string; userName: string; createdAt: Date };
type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  projectId: string | null;
  projectName: string | null;
  teamId: string | null;
  teamName: string | null;
  dueDate: Date | null;
  startDate: Date | null;
  assignees: Assignee[];
  comments: Comment[];
  createdByName: string;
};

type Member = { id: string; user: { id: string; name: string } };
type Sel = { id: string; name: string };

type Form = {
  title: string;
  description: string;
  status: string;
  priority: string;
  projectId: string;
  teamId: string;
  assigneeIds: string[];
  startDate: string;
  dueDate: string;
};

const emptyForm: Form = {
  title: "",
  description: "",
  status: "TODO",
  priority: "MEDIUM",
  projectId: "",
  teamId: "",
  assigneeIds: [],
  startDate: "",
  dueDate: "",
};

const FILTERS = [
  { key: "todas", label: "Todas" },
  { key: "abertas", label: "Abertas" },
  { key: "hoje", label: "Vencem hoje" },
  { key: "atrasadas", label: "Atrasadas" },
  { key: "concluidas", label: "Concluídas" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export function TasksClient({
  tasks,
  projects,
  teams,
  members,
  selfMemberId,
  selfUserId,
  canWrite,
  canDelete,
  openNew,
  openTaskId,
}: {
  tasks: Task[];
  projects: Sel[];
  teams: Sel[];
  members: Member[];
  selfMemberId: string;
  selfUserId: string;
  canWrite: boolean;
  canDelete: boolean;
  openNew: boolean;
  openTaskId: string | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("todas");
  const [dialog, setDialog] = useState<{ mode: "add" | "edit"; id?: string; form: Form } | null>(null);
  const [detail, setDetail] = useState<Task | null>(null);
  const [comment, setComment] = useState("");
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (openNew) setDialog({ mode: "add", form: emptyForm });
    else if (openTaskId) {
      const t = tasks.find((x) => x.id === openTaskId);
      if (t) setDetail(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNew, openTaskId]);

  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    switch (filter) {
      case "abertas":
        return tasks.filter((t) => t.status !== "DONE");
      case "hoje": {
        const end = new Date(today.getTime() + 86400000);
        return tasks.filter(
          (t) => t.dueDate && t.dueDate >= today && t.dueDate < end && t.status !== "DONE"
        );
      }
      case "atrasadas":
        return tasks.filter((t) => t.status !== "DONE" && t.dueDate && isPastDue(t.dueDate));
      case "concluidas":
        return tasks.filter((t) => t.status === "DONE");
      default:
        return tasks;
    }
  }, [tasks, filter]);

  const counts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today.getTime() + 86400000);
    const isToday = (t: Task) => t.dueDate && t.dueDate >= today && t.dueDate < end;
    return {
      todas: tasks.length,
      abertas: tasks.filter((t) => t.status !== "DONE").length,
      hoje: tasks.filter((t) => isToday(t) && t.status !== "DONE").length,
      atrasadas: tasks.filter((t) => t.status !== "DONE" && t.dueDate && isPastDue(t.dueDate)).length,
      concluidas: tasks.filter((t) => t.status === "DONE").length,
    };
  }, [tasks]);

  async function submit() {
    if (!dialog) return;
    setBusy(true);
    const f = dialog.form;
    const payload = {
      title: f.title,
      description: f.description || null,
      status: f.status,
      priority: f.priority,
      projectId: f.projectId || null,
      teamId: f.teamId || null,
      assigneeIds: f.assigneeIds,
      startDate: f.startDate || null,
      dueDate: f.dueDate || null,
    };
    const res: any =
      dialog.mode === "add" ? await createTask(payload) : await updateTask({ id: dialog.id!, ...payload });
    setBusy(false);
    if (res.success) {
      toast(dialog.mode === "add" ? "Tarefa criada." : "Tarefa atualizada.");
      setDialog(null);
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  async function quickStatus(task: Task, status: string) {
    const res: any = await setTaskStatus({ id: task.id, status });
    if (res.success) {
      toast("Status atualizado.");
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const res: any = await deleteTask(deleting.id);
    setBusy(false);
    if (res.success) {
      toast("Tarefa removida.");
      setDeleting(null);
      setDetail(null);
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  async function sendComment() {
    if (!detail || !comment.trim()) return;
    const res: any = await createComment({ taskId: detail.id, text: comment });
    if (res.success) {
      setComment("");
      toast("Comentário adicionado.");
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  function toggleAssignee(id: string) {
    setDialog((d) => {
      if (!d) return d;
      const has = d.form.assigneeIds.includes(id);
      return {
        ...d,
        form: {
          ...d.form,
          assigneeIds: has ? d.form.assigneeIds.filter((m) => m !== id) : [...d.form.assigneeIds, id],
        },
      };
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tarefas"
        description={`${counts.abertas} abertas · ${counts.concluidas} concluídas`}
        actions={
          canWrite && (
            <Button onClick={() => setDialog({ mode: "add", form: emptyForm })}>
              <Plus className="h-4 w-4" /> Nova tarefa
            </Button>
          )
        }
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              filter === f.key
                ? "bg-blue-600 text-white"
                : "border bg-card text-muted-foreground hover:bg-accent"
            )}
          >
            {f.label}{" "}
            <span className={filter === f.key ? "opacity-80" : "text-muted-foreground/70"}>
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ListTodo className="h-6 w-6" />}
          title="Nenhuma tarefa aqui"
          description="Mude o filtro ou crie uma nova tarefa."
          action={
            canWrite ? (
              <Button onClick={() => setDialog({ mode: "add", form: emptyForm })}>
                <Plus className="h-4 w-4" /> Nova tarefa
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarefa</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Responsáveis</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => {
                const overdue = t.status !== "DONE" && t.dueDate && isPastDue(t.dueDate);
                return (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => setDetail(t)}>
                    <TableCell>
                      <p className={cn("font-medium", t.status === "DONE" && "text-muted-foreground line-through")}>
                        {t.title}
                      </p>
                      {overdue && (
                        <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                          <CalendarClock className="h-3 w-3" /> Atrasada
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.projectName ?? "—"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Dropdown
                        trigger={statusBadge(t.status)}
                        items={[
                          ...["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].map((s) => ({
                            label: s.replace("_", " "),
                            onClick: () => quickStatus(t, s),
                          })),
                        ]}
                      />
                    </TableCell>
                    <TableCell>{statusBadge(t.priority)}</TableCell>
                    <TableCell>
                      <div className="flex -space-x-2">
                        {t.assignees.slice(0, 4).map((a) => (
                          <Avatar key={a.id} name={a.name} className="h-6 w-6 border-2 border-card text-[9px]" />
                        ))}
                        {t.assignees.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={overdue ? "font-medium text-red-600" : ""}>
                        {formatDate(t.dueDate)}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
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
                                          title: t.title,
                                          description: t.description ?? "",
                                          status: t.status,
                                          priority: t.priority,
                                          projectId: t.projectId ?? "",
                                          teamId: t.teamId ?? "",
                                          assigneeIds: t.assignees.map((a) => a.id),
                                          startDate: t.startDate ? fmtDate(t.startDate) : "",
                                          dueDate: t.dueDate ? fmtDate(t.dueDate) : "",
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
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Formulário criar/editar */}
      <Dialog
        open={Boolean(dialog)}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.mode === "add" ? "Nova tarefa" : "Editar tarefa"}
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
            <Input value={dialog?.form.title} onChange={(e) => setDialog((d) => d ? { ...d, form: { ...d.form, title: e.target.value } } : d)} placeholder="O que precisa ser feito?" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={dialog?.form.description} onChange={(e) => setDialog((d) => d ? { ...d, form: { ...d.form, description: e.target.value } } : d)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={dialog?.form.status} onChange={(e) => setDialog((d) => d ? { ...d, form: { ...d.form, status: e.target.value } } : d)}>
                <option value="BACKLOG">Backlog</option>
                <option value="TODO">A fazer</option>
                <option value="IN_PROGRESS">Em andamento</option>
                <option value="IN_REVIEW">Em revisão</option>
                <option value="DONE">Concluída</option>
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
              <Label>Projeto</Label>
              <Select value={dialog?.form.projectId} onChange={(e) => setDialog((d) => d ? { ...d, form: { ...d.form, projectId: e.target.value } } : d)}>
                <option value="">Nenhum</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
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
            <div>
              <Label>Início</Label>
              <Input type="date" value={dialog?.form.startDate} onChange={(e) => setDialog((d) => d ? { ...d, form: { ...d.form, startDate: e.target.value } } : d)} />
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={dialog?.form.dueDate} onChange={(e) => setDialog((d) => d ? { ...d, form: { ...d.form, dueDate: e.target.value } } : d)} />
            </div>
          </div>
          <div>
            <Label>Responsáveis</Label>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border p-2">
              {members.map((m) => {
                const active = dialog?.form.assigneeIds.includes(m.id) ?? false;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleAssignee(m.id)}
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

      {/* Detalhes da tarefa */}
      <Dialog
        open={Boolean(detail)}
        onOpenChange={(o) => !o && setDetail(null)}
        title={detail?.title}
        className="max-w-xl"
        description={
          detail ? `${detail.projectName ?? "Sem projeto"} · criada por ${detail.createdByName}` : ""
        }
        footer={
          <>
            {canDelete && (
              <Button variant="ghost" className="mr-auto text-red-600 hover:bg-red-50" onClick={() => setDeleting(detail)}>
                <Trash2 className="h-4 w-4" /> Remover
              </Button>
            )}
            {canWrite && (
              <>
                <Button variant="ghost" onClick={() => setDialog(null)}>Cancelar</Button>
                <Button
                  onClick={() => {
                    if (!detail) return;
                    setDialog({
                      mode: "edit",
                      id: detail.id,
                      form: {
                        title: detail.title,
                        description: detail.description ?? "",
                        status: detail.status,
                        priority: detail.priority,
                        projectId: detail.projectId ?? "",
                        teamId: detail.teamId ?? "",
                        assigneeIds: detail.assignees.map((a) => a.id),
                        startDate: detail.startDate ? fmtDate(detail.startDate) : "",
                        dueDate: detail.dueDate ? fmtDate(detail.dueDate) : "",
                      },
                    });
                  }}
                >
                  Editar
                </Button>
              </>
            )}
          </>
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {statusBadge(detail.status)}
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Flag className="h-3.5 w-3.5" /> Prioridade {detail.priority.toLowerCase()}
              </span>
              {detail.dueDate && (
                <span className={cn("flex items-center gap-1 text-xs", isPastDue(detail.dueDate) && detail.status !== "DONE" ? "text-red-600" : "text-muted-foreground")}>
                  <CalendarClock className="h-3.5 w-3.5" /> Para {formatDate(detail.dueDate)}
                </span>
              )}
            </div>
            {detail.description && <p className="whitespace-pre-wrap text-sm">{detail.description}</p>}
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Responsáveis</p>
              <div className="flex flex-wrap gap-2">
                {detail.assignees.map((a) => (
                  <span key={a.id} className="flex items-center gap-1.5 rounded-full bg-muted py-1 pl-1 pr-3 text-xs">
                    <Avatar name={a.name} className="h-5 w-5 text-[8px]" />
                    {a.name}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Comentários</p>
              <div className="space-y-2">
                {detail.comments.map((c) => (
                  <div key={c.id} className="rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium">{c.userName}</span>
                      <span className="text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-sm">{c.text}</p>
                  </div>
                ))}
                {detail.comments.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem comentários ainda.</p>
                )}
              </div>
              {canWrite && (
                <div className="mt-3 flex gap-2">
                  <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Escreva um comentário..." onKeyDown={(e) => e.key === "Enter" && sendComment()} />
                  <Button onClick={sendComment}>Enviar</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remover tarefa"
        description={deleting ? `Remover "${deleting.title}"?` : ""}
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