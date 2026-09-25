"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  UserRound,
  Lock,
  Bell,
  Monitor,
  Smartphone,
  Tablet,
  Save,
  Trash2,
  Upload,
  ShieldAlert,
} from "lucide-react";
import {
  updateProfile,
  changePassword,
  updatePreferences,
  updateAvatar,
  removeAvatar,
  revokeSession,
  revokeOtherSessions,
  deleteAccount,
} from "@/server/profile-actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/rbac";
import {
  DEFAULT_USER_PREFERENCES,
  TIMEZONES,
  LOCALES,
  type UserPreferences,
} from "@/lib/user-preferences";
import type { RoleName, MemberStatus } from "@prisma/client";

type TabId = "perfil" | "seguranca" | "preferencias" | "sessoes";

type SessionRow = {
  id: string;
  browser: string | null;
  device: string | null;
  os: string | null;
  ip: string | null;
  lastActiveAt: string;
  createdAt: string;
  current: boolean;
};

type Professional = {
  role: RoleName;
  status: MemberStatus;
  jobTitle: string | null;
  department: string | null;
  teams: string[];
  manager: string | null;
  entryDate: string;
} | null;

const TABS: { id: TabId; label: string; icon: typeof UserRound }[] = [
  { id: "perfil", label: "Perfil", icon: UserRound },
  { id: "seguranca", label: "Segurança", icon: Lock },
  { id: "preferencias", label: "Preferências", icon: Bell },
  { id: "sessoes", label: "Sessões", icon: Monitor },
];

const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days > 1 ? "s" : ""}`;
}

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function deviceIcon(device: string | null) {
  if (device === "Celular") return Smartphone;
  if (device === "Tablet") return Tablet;
  return Monitor;
}

export function ProfileClient({
  initialTab,
  user,
  preferences,
  sessions,
  professional,
  orgName,
  isOwner,
  blocked,
}: {
  initialTab: TabId;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
  };
  preferences: UserPreferences | null;
  sessions: SessionRow[];
  professional: Professional;
  orgName: string;
  isOwner: boolean;
  blocked?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabId>(initialTab);

  function go(next: TabId) {
    setTab(next);
    router.replace(`/profile?tab=${next}`, { scroll: false });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Meu perfil"
        description="Seus dados pessoais, segurança, preferências e sessões."
      />

      <div className="flex w-fit gap-1 overflow-x-auto rounded-lg border bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => go(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-blue-50 text-blue-700"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {blocked ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <CardTitle>Conta desativada</CardTitle>
            </div>
            <CardDescription>
              Sua conta está inativa na organização {orgName}. Fale com um
              administrador para reativar seu acesso.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : tab === "perfil" ? (
        <PerfilTab user={user} professional={professional} orgName={orgName} />
      ) : tab === "seguranca" ? (
        <SegurancaTab isOwner={isOwner} />
      ) : tab === "preferencias" ? (
        <PreferenciasTab preferences={preferences} />
      ) : (
        <SessoesTab sessions={sessions} />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// ABA: PERFIL
// ------------------------------------------------------------

function PerfilTab({
  user,
  professional,
  orgName,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
  };
  professional: Professional;
  orgName: string;
}) {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [form, setForm] = React.useState({
    name: user.name,
    phone: user.phone ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const [avatarBusy, setAvatarBusy] = React.useState(false);

  async function save() {
    if (form.name.trim().length < 2) {
      toast("Informe seu nome.", "error");
      return;
    }
    setSaving(true);
    const res: any = await updateProfile({
      name: form.name.trim(),
      phone: form.phone.trim() ? form.phone.trim() : null,
    });
    setSaving(false);
    if (res.success) {
      toast("Perfil atualizado.");
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      toast("Use uma imagem JPG, PNG ou WEBP.", "error");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast("A imagem pode ter no máximo 5 MB.", "error");
      return;
    }
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    setAvatarBusy(true);
    const res: any = await updateAvatar(dataUrl);
    setAvatarBusy(false);
    if (res.success) {
      toast("Foto de perfil atualizada.");
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro ao enviar a foto.", "error");
    }
  }

  async function onRemoveAvatar() {
    if (!user.avatarUrl) return;
    if (!window.confirm("Remover a foto de perfil?")) return;
    setAvatarBusy(true);
    const res: any = await removeAvatar();
    setAvatarBusy(false);
    if (res.success) {
      toast("Foto removida.");
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Dados pessoais</CardTitle>
          <CardDescription>
            Seu nome e telefone. O e-mail é o acesso à conta e não pode ser
            alterado por aqui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Foto de perfil</Label>
              <div className="flex items-center gap-3">
                <Avatar
                  name={user.name}
                  src={user.avatarUrl}
                  className="h-14 w-14 text-sm"
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept={AVATAR_TYPES.join(",")}
                  className="hidden"
                  onChange={onPickFile}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={avatarBusy}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" /> Alterar foto
                  </Button>
                  {user.avatarUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      loading={avatarBusy}
                      onClick={onRemoveAvatar}
                    >
                      <Trash2 className="h-4 w-4" /> Remover
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                JPG, PNG ou WEBP de até 5 MB.
              </p>
            </div>

            <div>
              <Label htmlFor="profile-name">Nome</Label>
              <Input
                id="profile-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={120}
              />
            </div>
            <div>
              <Label htmlFor="profile-phone">Telefone</Label>
              <Input
                id="profile-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
                maxLength={30}
              />
            </div>
            <div>
              <Label htmlFor="profile-email">E-mail</Label>
              <Input id="profile-email" value={user.email} disabled />
              <p className="mt-1 text-xs text-muted-foreground">
                E-mail de acesso — não editável.
              </p>
            </div>
            <Button type="button" onClick={save} loading={saving}>
              <Save className="h-4 w-4" /> Salvar alterações
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados profissionais</CardTitle>
          <CardDescription>
            Gerenciados pela organização {orgName}. Somente leitura no perfil.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <ReadRow label="Organização" value={orgName} />
            <ReadRow
              label="Perfil"
              value={professional ? ROLE_LABEL[professional.role] : "—"}
            />
            <ReadRow
              label="Cargo"
              value={professional?.jobTitle ?? "—"}
              className="col-span-2"
            />
            <ReadRow
              label="Departamento"
              value={professional?.department ?? "—"}
            />
            <ReadRow
              label="Gestor"
              value={professional?.manager ?? "—"}
            />
            <ReadRow
              label="Equipes"
              value={
                professional && professional.teams.length > 0
                  ? professional.teams.join(", ")
                  : "—"
              }
              className="col-span-2"
            />
            <ReadRow
              label="Data de entrada"
              value={
                professional
                  ? new Date(professional.entryDate).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  : "—"
              }
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function ReadRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{value}</dd>
    </div>
  );
}

// ------------------------------------------------------------
// ABA: SEGURANÇA
// ------------------------------------------------------------

function SegurancaTab({ isOwner }: { isOwner: boolean }) {
  const router = useRouter();
  const [pw, setPw] = React.useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [pwBusy, setPwBusy] = React.useState(false);
  const [delOpen, setDelOpen] = React.useState(false);
  const [delPassword, setDelPassword] = React.useState("");
  const [delBusy, setDelBusy] = React.useState(false);

  async function savePassword() {
    if (pw.next.length < 6) {
      toast("A nova senha precisa de no mínimo 6 caracteres.", "error");
      return;
    }
    if (pw.next !== pw.confirm) {
      toast("As senhas não coincidem.", "error");
      return;
    }
    setPwBusy(true);
    const res: any = await changePassword({
      currentPassword: pw.current,
      newPassword: pw.next,
      confirm: pw.confirm,
    });
    setPwBusy(false);
    if (res.success) {
      toast("Senha alterada. As outras sessões foram encerradas.");
      setPw({ current: "", next: "", confirm: "" });
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  async function confirmDelete() {
    if (!delPassword) return;
    if (
      !window.confirm(
        "Esta ação é permanente. Excluir sua conta agora?"
      )
    )
      return;
    setDelBusy(true);
    const res: any = await deleteAccount({ password: delPassword });
    setDelBusy(false);
    if (res.success) {
      toast("Conta excluída.");
      router.push("/login");
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-blue-600" />
            <CardTitle>Alterar senha</CardTitle>
          </div>
          <CardDescription>
            Ao alterar, as outras sessões são encerradas. Mínimo de 8
            caracteres.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="pw-current">Senha atual</Label>
              <Input
                id="pw-current"
                type="password"
                autoComplete="current-password"
                value={pw.current}
                onChange={(e) =>
                  setPw((f) => ({ ...f, current: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="pw-next">Nova senha</Label>
              <Input
                id="pw-next"
                type="password"
                autoComplete="new-password"
                value={pw.next}
                onChange={(e) => setPw((f) => ({ ...f, next: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="pw-confirm">Confirmar nova senha</Label>
              <Input
                id="pw-confirm"
                type="password"
                autoComplete="new-password"
                value={pw.confirm}
                onChange={(e) =>
                  setPw((f) => ({ ...f, confirm: e.target.value }))
                }
              />
            </div>
            <Button
              type="button"
              variant="outline"
              loading={pwBusy}
              onClick={savePassword}
            >
              <Save className="h-4 w-4" /> Alterar senha
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-600" />
            <CardTitle>Zona de perigo</CardTitle>
          </div>
          <CardDescription>
            Excluir sua conta remove seu acesso pessoal ao TeamFlow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isOwner && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Você é proprietário de uma organização. Transfira a propriedade
              ou remova a organização antes de excluir a conta.
            </p>
          )}
          {!delOpen ? (
            <Button
              type="button"
              variant="destructive"
              disabled={isOwner}
              onClick={() => setDelOpen(true)}
            >
              <Trash2 className="h-4 w-4" /> Excluir minha conta
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Digite sua senha para confirmar. Esta ação não pode ser
                desfeita.
              </p>
              <div>
                <Label htmlFor="del-password">Senha</Label>
                <Input
                  id="del-password"
                  type="password"
                  autoComplete="current-password"
                  value={delPassword}
                  onChange={(e) => setDelPassword(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!delPassword}
                  loading={delBusy}
                  onClick={confirmDelete}
                >
                  Confirmar exclusão
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setDelOpen(false);
                    setDelPassword("");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------
// ABA: PREFERÊNCIAS
// ------------------------------------------------------------

function PreferenciasTab({
  preferences,
}: {
  preferences: UserPreferences | null;
}) {
  const router = useRouter();
  const [prefs, setPrefs] = React.useState<UserPreferences>(
    preferences ?? DEFAULT_USER_PREFERENCES
  );
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    const res: any = await updatePreferences(prefs);
    setBusy(false);
    if (res.success) {
      toast("Preferências salvas.");
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  const notifItems: {
    key: keyof Pick<
      UserPreferences,
      | "taskNotifications"
      | "projectNotifications"
      | "goalNotifications"
      | "announcementNotifications"
    >;
    title: string;
    description: string;
  }[] = [
    {
      key: "taskNotifications",
      title: "Tarefas e menções",
      description: "Tarefas atribuídas a você e menções.",
    },
    {
      key: "projectNotifications",
      title: "Projetos",
      description: "Atualizações dos projetos em que você participa.",
    },
    {
      key: "goalNotifications",
      title: "Metas",
      description: "Metas em risco ou concluídas.",
    },
    {
      key: "announcementNotifications",
      title: "Avisos da organização",
      description: "Comunicados da liderança.",
    },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-600" />
            <CardTitle>Notificações</CardTitle>
          </div>
          <CardDescription>
            Canal no aplicativo — é o único disponível hoje. E-mail não está
            disponível no momento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {notifItems.map((item) => (
              <label
                key={item.key}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-input"
                  checked={prefs[item.key]}
                  onChange={(e) =>
                    setPrefs((f) => ({ ...f, [item.key]: e.target.checked }))
                  }
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {item.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regionalização</CardTitle>
          <CardDescription>
            Idioma, fuso horário e tema do aplicativo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pref-locale">Idioma</Label>
                <Select
                  id="pref-locale"
                  value={prefs.locale}
                  onChange={(e) =>
                    setPrefs((f) => ({ ...f, locale: e.target.value }))
                  }
                >
                  {LOCALES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="pref-timezone">Fuso horário</Label>
                <Select
                  id="pref-timezone"
                  value={prefs.timezone}
                  onChange={(e) =>
                    setPrefs((f) => ({ ...f, timezone: e.target.value }))
                  }
                >
                  {TIMEZONES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label>Tema</Label>
              <p className="text-sm text-muted-foreground">
                O aplicativo usa tema claro.
              </p>
            </div>
            <Button type="button" loading={busy} onClick={save}>
              <Save className="h-4 w-4" /> Salvar preferências
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------
// ABA: SESSÕES
// ------------------------------------------------------------

function SessoesTab({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [othersBusy, setOthersBusy] = React.useState(false);
  const others = sessions.filter((s) => !s.current).length;

  async function revokeOne(row: SessionRow) {
    if (!window.confirm("Encerrar esta sessão?")) return;
    setBusyId(row.id);
    const res: any = await revokeSession(row.id);
    setBusyId(null);
    if (res.success) {
      toast("Sessão encerrada.");
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  async function revokeOthers() {
    if (
      !window.confirm(
        `Encerrar ${others} outra${others > 1 ? "s" : ""} sessão${
          others > 1 ? "ões" : ""
        }?`
      )
    )
      return;
    setOthersBusy(true);
    const res: any = await revokeOtherSessions();
    setOthersBusy(false);
    if (res.success) {
      toast(
        res.data?.revoked
          ? `${res.data.revoked} sessão(ões) encerrada(s).`
          : "Nenhuma outra sessão ativa."
      );
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-blue-600" />
            <CardTitle>Sessões ativas</CardTitle>
          </div>
          <CardDescription>
            Dispositivos conectados à sua conta. Encerrar uma sessão exige
            login novamente naquele dispositivo.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={others === 0}
          loading={othersBusy}
          onClick={revokeOthers}
        >
          Encerrar outras sessões
        </Button>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma sessão registrada.</p>
        ) : (
          <ul className="divide-y">
            {sessions.map((s) => {
              const Icon = deviceIcon(s.device);
              return (
                <li key={s.id} className="flex items-center gap-3 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 truncate text-sm font-medium">
                      {[s.browser, s.os].filter(Boolean).join(" · ") ||
                        "Dispositivo desconhecido"}
                      {s.current && <Badge variant="success">Este dispositivo</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.ip ? `IP: ${s.ip} · ` : ""}
                      Última atividade: {relativeTime(s.lastActiveAt)} · Início:{" "}
                      {absoluteTime(s.createdAt)}
                    </p>
                  </div>
                  {!s.current && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      loading={busyId === s.id}
                      onClick={() => revokeOne(s)}
                    >
                      Encerrar
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
