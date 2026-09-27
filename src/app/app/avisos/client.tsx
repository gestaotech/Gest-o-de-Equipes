"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Megaphone } from "lucide-react";
import { createAnnouncement, deleteAnnouncement } from "@/server/work-actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dropdown } from "@/components/ui/dropdown";
import { formatDate, formatRelative } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/types";

type Announcement = {
  id: string;
  title: string;
  message: string;
  audience: string;
  createdByName: string;
  createdAt: Date;
};

type Sel = { id: string; name: string };
type Member = { user: { id: string; name: string } };

const audienceLabel: Record<string, string> = {
  company: "Toda a empresa",
  team: "Equipe",
  department: "Departamento",
  user: "Colaborador",
};

export function AnnouncementsClient({
  announcements,
  teams,
  departments,
  members,
  canWrite,
  canDelete,
}: {
  announcements: Announcement[];
  teams: Sel[];
  departments: Sel[];
  members: Member[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState(false);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    message: "",
    audience: "company",
    audienceId: "",
  });

  async function submit() {
    setBusy(true);
    const res = (await createAnnouncement({
      title: form.title,
      message: form.message,
      audience: form.audience,
      audienceId: form.audience === "company" ? null : form.audienceId || null,
    })) as ActionResult;
    setBusy(false);
    if (res.success) {
      toast("Aviso publicado.");
      setDialog(false);
      setForm({ title: "", message: "", audience: "company", audienceId: "" });
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const res = (await deleteAnnouncement(deleting.id)) as ActionResult;
    setBusy(false);
    if (res.success) {
      toast("Aviso removido.");
      setDeleting(null);
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Avisos"
        description="Comunique o time de forma centralizada."
        actions={
          canWrite && (
            <Button onClick={() => setDialog(true)}>
              <Plus className="h-4 w-4" /> Novo aviso
            </Button>
          )
        }
      />

      {announcements.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-6 w-6" />}
          title="Nenhum aviso"
          description="Publique comunicados para a empresa ou para grupos específicos."
          action={
            canWrite ? (
              <Button onClick={() => setDialog(true)}>
                <Plus className="h-4 w-4" /> Publicar aviso
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{a.title}</h3>
                    <Badge variant="secondary">{audienceLabel[a.audience] ?? a.audience}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {a.createdByName} · {formatRelative(a.createdAt)} · {formatDate(a.createdAt)}
                  </p>
                </div>
                {canDelete && (
                  <Dropdown
                    trigger={<Button variant="ghost" size="sm">•••</Button>}
                    items={[
                      {
                        label: "Remover",
                        icon: <Trash2 className="h-4 w-4" />,
                        danger: true,
                        onClick: () => setDeleting(a),
                      },
                    ]}
                  />
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{a.message}</p>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={dialog}
        onOpenChange={setDialog}
        title="Publicar aviso"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={submit} loading={busy}>Publicar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex.: Manutenção programada" />
          </div>
          <div>
            <Label>Mensagem *</Label>
            <Textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="Escreva o comunicado..." />
          </div>
          <div>
            <Label>Público</Label>
            <Select value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value, audienceId: "" }))}>
              <option value="company">Toda a empresa</option>
              <option value="team">Equipe</option>
              <option value="department">Departamento</option>
              <option value="user">Colaborador</option>
            </Select>
          </div>
          {form.audience === "team" && (
            <div>
              <Label>Selecione a equipe</Label>
              <Select value={form.audienceId} onChange={(e) => setForm((f) => ({ ...f, audienceId: e.target.value }))}>
                <option value="">Escolher...</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
          )}
          {form.audience === "department" && (
            <div>
              <Label>Selecione o departamento</Label>
              <Select value={form.audienceId} onChange={(e) => setForm((f) => ({ ...f, audienceId: e.target.value }))}>
                <option value="">Escolher...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </div>
          )}
          {form.audience === "user" && (
            <div>
              <Label>Selecione o colaborador</Label>
              <Select value={form.audienceId} onChange={(e) => setForm((f) => ({ ...f, audienceId: e.target.value }))}>
                <option value="">Escolher...</option>
                {members.map((m, i) => (
                  <option key={i} value={m.user.id}>{m.user.name}</option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </Dialog>

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remover aviso"
        description={deleting ? `Remover o aviso "${deleting.title}"?` : ""}
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