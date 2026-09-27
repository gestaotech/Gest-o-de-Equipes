"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Calendar, CalendarClock, Users, User, FolderKanban } from "lucide-react";
import { createEvent, deleteEvent } from "@/server/work-actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dropdown } from "@/components/ui/dropdown";
import { formatDateTime } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/types";

type Evt = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  allDay: boolean;
  startsAt: Date;
  endsAt: Date | null;
  projectId: string | null;
  projectName: string | null;
  teamId: string | null;
  teamName: string | null;
  user: { id: string; name: string } | null;
};

type Sel = { id: string; name: string };

type Form = {
  title: string;
  description: string;
  type: string;
  allDay: boolean;
  startsDate: string;
  startsTime: string;
  endsDate: string;
  endsTime: string;
  teamId: string;
  projectId: string;
};

const typeIcon: Record<string, React.ReactNode> = {
  evento: <Calendar className="h-4 w-4" />,
  reuniao: <Users className="h-4 w-4" />,
  pessoal: <User className="h-4 w-4" />,
  projeto: <FolderKanban className="h-4 w-4" />,
};

const typeLabel: Record<string, string> = {
  evento: "Evento",
  reuniao: "Reunião",
  pessoal: "Pessoal",
  projeto: "Projeto",
};

export function AgendaClient({
  events,
  teams,
  projects,
  canWrite,
}: {
  events: Evt[];
  teams: Sel[];
  projects: Sel[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState(false);
  const [deleting, setDeleting] = useState<Evt | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Form>(defaultForm());

  function defaultForm(v?: Partial<Form>): Form {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    return {
      title: "",
      description: "",
      type: "evento",
      allDay: false,
      startsDate: date,
      startsTime: time,
      endsDate: date,
      endsTime: time,
      teamId: "",
      projectId: "",
      ...v,
    };
  }

  async function submit() {
    setBusy(true);
    const startsAt = new Date(`${form.startsDate}T${form.startsTime || "09:00"}`);
    const endsAt = form.endsDate
      ? new Date(`${form.endsDate}T${form.endsTime || "10:00"}`)
      : null;
    const res = (await createEvent({
      title: form.title,
      description: form.description || null,
      type: form.type,
      allDay: form.allDay,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt ? endsAt.toISOString() : null,
      teamId: form.teamId || null,
      projectId: form.projectId || null,
    })) as ActionResult;
    setBusy(false);
    if (res.success) {
      toast("Evento criado.");
      setDialog(false);
      setForm(defaultForm());
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const res = (await deleteEvent(deleting.id)) as ActionResult;
    setBusy(false);
    if (res.success) {
      toast("Evento removido.");
      setDeleting(null);
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  const groups = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    const map = new Map<string, Evt[]>();
    for (const e of sorted) {
      const key = new Date(e.startsAt).toLocaleDateString("pt-BR");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()];
  }, [events]);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Agenda"
        description="Reuniões, eventos e prazos do time."
        actions={
          canWrite && (
            <Button onClick={() => { setForm(defaultForm()); setDialog(true); }}>
              <Plus className="h-4 w-4" /> Novo evento
            </Button>
          )
        }
      />

      {events.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-6 w-6" />}
          title="Nenhum evento"
          description="Agende reuniões, eventos de equipe e marcos de projeto."
          action={
            canWrite ? (
              <Button onClick={() => { setForm(defaultForm()); setDialog(true); }}>
                <Plus className="h-4 w-4" /> Criar evento
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map(([day, evts]) => (
            <div key={day}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {day}
              </h3>
              <div className="space-y-3">
                {evts.map((e) => {
                  const Icon = typeIcon[e.type] ?? typeIcon.evento;
                  return (
                    <Card key={e.id} className="flex items-start gap-3 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        {Icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{e.title}</p>
                          <Badge variant="secondary">{typeLabel[e.type] ?? e.type}</Badge>
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {e.allDay ? "Dia inteiro" : formatDateTime(e.startsAt)}
                          {e.endsAt ? ` — ${formatDateTime(e.endsAt)}` : ""}
                        </p>
                        {e.description && (
                          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{e.description}</p>
                        )}
                        {(e.teamName || e.projectName) && (
                          <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                            {e.teamName && <Badge variant="outline">{e.teamName}</Badge>}
                            {e.projectName && <Badge variant="outline">{e.projectName}</Badge>}
                          </div>
                        )}
                      </div>
                      {canWrite && (
                        <Dropdown
                          trigger={<Button variant="ghost" size="sm">•••</Button>}
                          items={[
                            {
                              label: "Remover",
                              icon: <Trash2 className="h-4 w-4" />,
                              danger: true,
                              onClick: () => setDeleting(e),
                            },
                          ]}
                        />
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={dialog}
        onOpenChange={setDialog}
        title="Novo evento"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={submit} loading={busy}>Salvar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ex.: Reunião semanal" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onChange={(e) => set({ type: e.target.value })}>
                <option value="evento">Evento</option>
                <option value="reuniao">Reunião</option>
                <option value="pessoal">Pessoal</option>
                <option value="projeto">Marco de projeto</option>
              </Select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.allDay}
                  onChange={(e) => set({ allDay: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                Dia inteiro
              </label>
            </div>
            <div>
              <Label>Início (data)</Label>
              <Input type="date" value={form.startsDate} onChange={(e) => set({ startsDate: e.target.value })} />
            </div>
            {!form.allDay && (
              <div>
                <Label>Início (hora)</Label>
                <Input type="time" value={form.startsTime} onChange={(e) => set({ startsTime: e.target.value })} />
              </div>
            )}
            <div>
              <Label>Fim (data)</Label>
              <Input type="date" value={form.endsDate} onChange={(e) => set({ endsDate: e.target.value })} />
            </div>
            {!form.allDay && (
              <div>
                <Label>Fim (hora)</Label>
                <Input type="time" value={form.endsTime} onChange={(e) => set({ endsTime: e.target.value })} />
              </div>
            )}
            <div>
              <Label>Equipe</Label>
              <Select value={form.teamId} onChange={(e) => set({ teamId: e.target.value })}>
                <option value="">Nenhuma</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Projeto</Label>
              <Select value={form.projectId} onChange={(e) => set({ projectId: e.target.value })}>
                <option value="">Nenhum</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remover evento"
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