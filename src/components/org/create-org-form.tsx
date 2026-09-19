"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createOrganization } from "@/server/org-actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { slugify } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/types";

export function CreateOrgForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => {
      const name = String(formData.get("name") ?? "");
      const res = (await createOrganization({
        name,
        segment: String(formData.get("segment") ?? "") || undefined,
        size: String(formData.get("size") ?? "") || undefined,
      })) as ActionResult;
      if (res.success) {
        toast("Empresa criada!");
        setTimeout(() => {
          router.push("/onboarding");
          router.refresh();
        }, 200);
      } else {
        toast(res.error?.message ?? "Erro ao criar empresa.", "error");
      }
      return res;
    },
    { success: false }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar sua empresa</CardTitle>
        <p className="text-sm text-muted-foreground">
          Último passo para começar. Configure sua organização no TeamFlow.
        </p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome da empresa</Label>
            <Input id="name" name="name" required autoComplete="organization" placeholder="Ex.: Tech Solutions Ltda" />
          </div>
          <div>
            <Label htmlFor="segment">Segmento</Label>
            <Select id="segment" name="segment" defaultValue="">
              <option value="">Selecione (opcional)</option>
              <option value="tecnologia">Tecnologia</option>
              <option value="construcao">Construção</option>
              <option value="servicos">Serviços</option>
              <option value="comercio">Comércio</option>
              <option value="saude">Saúde</option>
              <option value="educacao">Educação</option>
              <option value="industria">Indústria</option>
              <option value="outro">Outro</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="size">Quantos colaboradores?</Label>
            <Select id="size" name="size" defaultValue="">
              <option value="">Selecione (opcional)</option>
              <option value="1-10">1 a 10</option>
              <option value="11-50">11 a 50</option>
              <option value="51-200">51 a 200</option>
              <option value="200+">Mais de 200</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="slug">Endereço da sua equipe (URL)</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">teamflow.app/</span>
              <Input id="slug" name="slug" placeholder="sua-empresa" className="flex-1 font-mono text-sm" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Se vazio, será gerado automaticamente a partir do nome.
            </p>
          </div>
          {state.error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error.message}
            </div>
          )}
          <Button type="submit" className="w-full" loading={pending}>
            Criar empresa
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}