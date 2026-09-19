"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, User, Shield, CreditCard, Save } from "lucide-react";
import { updateOrganizationInfo } from "@/server/org-actions";
import { updateAccountInfo } from "@/server/auth-actions";
import { setMemberRole } from "@/server/people-actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { ROLE_LABEL, ROLE_ORDER } from "@/lib/rbac";
import type { RoleName } from "@prisma/client";

type Member = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: RoleName;
  jobTitle: string | null;
};

const roleOptions: RoleName[] = ["OWNER", "ADMIN", "MANAGER", "LEADER", "MEMBER"];

export function SettingsClient({
  org,
  user,
  plan,
  members,
  selfUserId,
  canManageMembers,
  memberCount,
}: {
  org: { id: string; name: string; segment: string; size: string; slug: string };
  user: { id: string; name: string; email: string };
  plan: { name: string; tier: string; priceMonthly: number; maxUsers: number | null } | null;
  members: Member[];
  selfUserId: string;
  canManageMembers: boolean;
  memberCount: number;
}) {
  const router = useRouter();
  const [orgForm, setOrgForm] = useState({ name: org.name, segment: org.segment, size: org.size });
  const [accountForm, setAccountForm] = useState({ name: user.name, currentPassword: "", newPassword: "", confirm: "" });
  const [busySection, setBusySection] = useState<string | null>(null);

  async function saveOrg() {
    setBusySection("org");
    const res: any = await updateOrganizationInfo(orgForm);
    setBusySection(null);
    if (res.success) {
      toast("Organização atualizada.");
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  async function saveAccount() {
    setBusySection("account");
    if (accountForm.newPassword && accountForm.newPassword !== accountForm.confirm) {
      toast("As senhas não coincidem.", "error");
      setBusySection(null);
      return;
    }
    const res: any = await updateAccountInfo({
      name: accountForm.name,
      currentPassword: accountForm.currentPassword || undefined,
      newPassword: accountForm.newPassword || undefined,
    });
    setBusySection(null);
    if (res.success) {
      toast("Conta atualizada.");
      setAccountForm((f) => ({ ...f, currentPassword: "", newPassword: "", confirm: "" }));
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  async function changeRole(member: Member, role: string) {
    const res: any = await setMemberRole({ id: member.id, role });
    if (res.success) {
      toast("Permissão atualizada.");
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  const limitReached =
    plan?.maxUsers != null ? memberCount >= plan.maxUsers : false;

  return (
    <div className="space-y-5">
      <PageHeader title="Configurações" description="Organização, conta, plano e permissões." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <CardTitle>Informações da organização</CardTitle>
            </div>
            <CardDescription>Dados da sua empresa no TeamFlow.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={orgForm.name} onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Segmento</Label>
                  <Select value={orgForm.segment} onChange={(e) => setOrgForm((f) => ({ ...f, segment: e.target.value }))}>
                    <option value="">—</option>
                    {["tecnologia", "construcao", "servicos", "comercio", "saude", "educacao", "industria", "outro"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Colaboradores</Label>
                  <Select value={orgForm.size} onChange={(e) => setOrgForm((f) => ({ ...f, size: e.target.value }))}>
                    <option value="">—</option>
                    {["1-10", "11-50", "51-200", "200+"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <Label>Endereço (slug)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">teamflow.app/</span>
                  <Input value={org.slug} disabled className="font-mono text-sm" />
                </div>
              </div>
              <Button onClick={saveOrg} loading={busySection === "org"}>
                <Save className="h-4 w-4" /> Salvar alterações
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-600" />
                <CardTitle>Plano atual</CardTitle>
              </div>
              <CardDescription>Limites do plano {org.name}.</CardDescription>
            </CardHeader>
            <CardContent>
              {plan ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{plan.name}</p>
                    <p className="text-sm text-muted-foreground">
                      R$ {plan.priceMonthly}/mês
                      {plan.maxUsers ? ` · até ${plan.maxUsers} colaboradores` : " · colaboradores ilimitados"}
                    </p>
                  </div>
                  <Badge>{plan.tier}</Badge>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Plano não associado.</p>
              )}
              {limitReached && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Você atingiu o limite de colaboradores do plano {plan?.name}. Faça upgrade para adicionar mais.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600" />
                <CardTitle>Minha conta</CardTitle>
              </div>
              <CardDescription>Seu nome e sua senha de acesso.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  <Input value={accountForm.name} onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <Label>Senha atual</Label>
                  <Input type="password" value={accountForm.currentPassword} onChange={(e) => setAccountForm((f) => ({ ...f, currentPassword: e.target.value }))} placeholder="Para alterar a senha" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nova senha</Label>
                    <Input type="password" value={accountForm.newPassword} onChange={(e) => setAccountForm((f) => ({ ...f, newPassword: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Confirmar</Label>
                    <Input type="password" value={accountForm.confirm} onChange={(e) => setAccountForm((f) => ({ ...f, confirm: e.target.value }))} />
                  </div>
                </div>
                <Button onClick={saveAccount} variant="outline" loading={busySection === "account"}>
                  <Save className="h-4 w-4" /> Atualizar conta
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-600" />
            <CardTitle>Permissões e membros</CardTitle>
          </div>
          <CardDescription>
            Gerencie o papel de cada colaborador ({memberCount} no total).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum integrante.</p>
          ) : (
            <ul className="divide-y">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <Avatar name={m.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {m.name} {m.userId === selfUserId && <span className="text-xs text-muted-foreground">(você)</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.jobTitle || m.email}
                    </p>
                  </div>
                  {canManageMembers ? (
                    <Select
                      className="w-44"
                      defaultValue={m.role}
                      onChange={(e) => changeRole(m, e.target.value)}
                      disabled={m.userId === selfUserId}
                    >
                      {roleOptions
                        .filter((r) => r !== "OWNER" || m.role === "OWNER")
                        .map((r) => (
                          <option key={r} value={r} disabled={ROLE_ORDER[r] < ROLE_ORDER[m.role] && r !== "OWNER" && m.role !== "OWNER" ? false : false}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                    </Select>
                  ) : (
                    <Badge>{ROLE_LABEL[m.role]}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}