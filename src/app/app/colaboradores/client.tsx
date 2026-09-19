"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { addCollaborator, updateCollaborator, removeCollaborator } from "@/server/people-actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, statusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown } from "@/components/ui/dropdown";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/rbac";
import type { RoleName } from "@prisma/client";

type Member = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: RoleName;
  status: string;
  jobTitle: string | null;
  phone: string | null;
  entryDate: Date | null;
  departmentId: string | null;
  teamIds: string[];
  managerId: string | null;
  managerName: string | null;
};

type Sel = { id: string; name: string };

type Form = {
  id?: string;
  name: string;
  email: string;
  jobTitle: string;
  permission: string;
  departmentId: string;
  teamId: string;
  managerId: string;
  phone: string;
  entryDate: string;
};

const empty: Form = {
  name: "",
  email: "",
  jobTitle: "",
  permission: "MEMBER",
  departmentId: "",
  teamId: "",
  managerId: "",
  phone: "",
  entryDate: "",
};

export function TeammatesClient({
  members,
  selfMemberId,
  canWrite,
  canDelete,
  teams,
  departments,
  managers,
}: {
  members: Member[];
  selfMemberId: string;
  canWrite: boolean;
  canDelete: boolean;
  teams: Sel[];
  departments: Sel[];
  managers: { id: string; user: { name: string } }[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ mode: "add" | "edit"; form: Form; id?: string } | null>(null);
  const [deleting, setDeleting] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);

  function openEdit(m: Member) {
    setDialog({
      mode: "edit",
      id: m.id,
      form: {
        name: m.name,
        email: m.email,
        jobTitle: m.jobTitle ?? "",
        permission: m.role,
        departmentId: m.departmentId ?? "",
        teamId: m.teamIds[0] ?? "",
        managerId: m.managerId ?? "",
        phone: m.phone ?? "",
        entryDate: m.entryDate ? formatDate(m.entryDate).split("/").reverse().join("-") : "",
      },
    });
  }

  async function submit() {
    if (!dialog) return;
    setBusy(true);
    const payload = {
      name: dialog.form.name,
      email: dialog.form.email,
      role: dialog.form.jobTitle,
      jobTitle: dialog.form.jobTitle,
      permission: dialog.form.permission,
      departmentId: dialog.form.departmentId || null,
      teamId: dialog.form.teamId || null,
      managerId: dialog.form.managerId || null,
      phone: dialog.form.phone || null,
      entryDate: dialog.form.entryDate || null,
    };
    const res: any =
      dialog.mode === "add"
        ? await addCollaborator(payload)
        : await updateCollaborator({ id: dialog.id!, ...payload });
    setBusy(false);
    if (res.success) {
      toast(dialog.mode === "add" ? "Colaborador adicionado!" : "Colaborador atualizado.");
      setDialog(null);
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const res: any = await removeCollaborator(deleting.id);
    setBusy(false);
    if (res.success) {
      toast("Colaborador removido.");
      setDeleting(null);
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  const set = (patch: Partial<Form>) =>
    setDialog((d) => (d ? { ...d, form: { ...d.form, ...patch } } : d));

  const options: { label: string; value: string }[] = [
    { label: "Membro", value: "MEMBER" },
    { label: "Líder", value: "LEADER" },
    { label: "Gerente", value: "MANAGER" },
    { label: "Administrador", value: "ADMIN" },
    { label: "Proprietário", value: "OWNER" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Colaboradores"
        description={`${members.filter((m) => m.status === "ATIVO").length} ativos de ${members.length} no total.`}
        actions={
          canWrite && (
            <Button onClick={() => setDialog({ mode: "add", form: empty })}>
              <Plus className="h-4 w-4" /> Adicionar colaborador
            </Button>
          )
        }
      />

      {members.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Nenhum colaborador ainda"
          description="Adicione seu primeiro colaborador para começar a organizar o time."
          action={
            canWrite ? (
              <Button onClick={() => setDialog({ mode: "add", form: empty })}>
                <Plus className="h-4 w-4" /> Adicionar colaborador
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Equipe</TableHead>
                <TableHead>Gestor</TableHead>
                <TableHead>Permissão</TableHead>
                <TableHead>Admissão</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{m.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.email}
                          {m.id === selfMemberId ? " · você" : ""}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.jobTitle ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {departments.find((d) => d.id === m.departmentId)?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.teamIds.map(
                      (tid) => teams.find((t) => t.id === tid)?.name
                    ).filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.managerName ?? "—"}</TableCell>
                  <TableCell>
                    <Badge>{ROLE_LABEL[m.role]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(m.entryDate)}</TableCell>
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
                                  onClick: () => openEdit(m),
                                },
                              ]
                            : []),
                          ...(canDelete
                            ? [
                                {
                                  label: "Remover",
                                  icon: <Trash2 className="h-4 w-4" />,
                                  danger: true,
                                  onClick: () => setDeleting(m),
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
        title={dialog?.mode === "add" ? "Adicionar colaborador" : "Editar colaborador"}
        description="Preencha os dados do membro do time."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={submit} loading={busy}>Salvar</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nome completo *</Label>
            <Input value={dialog?.form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Nome do colaborador" required />
          </div>
          <div className="sm:col-span-2">
            <Label>E-mail</Label>
            <Input value={dialog?.form.email} onChange={(e) => set({ email: e.target.value })} placeholder="voce@empresa.com" />
            <p className="mt-1 text-xs text-muted-foreground">
              Sem e-mail, o colaborador não poderá acessar. Pode preencher depois.
            </p>
          </div>
          <div>
            <Label>Cargo</Label>
            <Input value={dialog?.form.jobTitle} onChange={(e) => set({ jobTitle: e.target.value })} placeholder="Ex.: Analista" />
          </div>
          <div>
            <Label>Permissão</Label>
            <Select value={dialog?.form.permission} onChange={(e) => set({ permission: e.target.value })}>
              {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Departamento</Label>
            <Select value={dialog?.form.departmentId} onChange={(e) => set({ departmentId: e.target.value })}>
              <option value="">Nenhum</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Equipe</Label>
            <Select value={dialog?.form.teamId} onChange={(e) => set({ teamId: e.target.value })}>
              <option value="">Nenhuma</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Gestor</Label>
            <Select value={dialog?.form.managerId} onChange={(e) => set({ managerId: e.target.value })}>
              <option value="">Nenhum</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.user.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={dialog?.form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <Label>Data de admissão</Label>
            <Input type="date" value={dialog?.form.entryDate} onChange={(e) => set({ entryDate: e.target.value })} />
          </div>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remover colaborador"
        description={
          deleting
            ? `Deseja remover ${deleting.name} da organização? O usuário ficará sem acesso a ${"esta empresa"} (a conta pode continuar em outras).`
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