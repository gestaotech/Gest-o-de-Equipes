"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/types";

export function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("t") ?? "";

  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => {
      const res = (await resetPassword({
        token: String(formData.get("token") ?? token),
        password: String(formData.get("password") ?? ""),
        confirm: String(formData.get("confirm") ?? ""),
      })) as ActionResult;
      if (res.success) {
        toast("Senha redefinida! Faça login.");
        setTimeout(() => router.push("/login"), 400);
      } else {
        toast(res.error?.message ?? "Erro ao redefinir senha.", "error");
      }
      return res;
    },
    { success: false }
  );

  if (!token) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Link inválido. Solicite novamente a recuperação.</p>
          <Link href="/recuperar-senha" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
            Voltar
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Redefinir senha</CardTitle>
        <p className="text-sm text-muted-foreground">Defina uma nova senha para sua conta.</p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <Label htmlFor="password">Nova senha</Label>
            <Input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" />
          </div>
          <div>
            <Label htmlFor="confirm">Confirme a senha</Label>
            <Input id="confirm" name="confirm" type="password" required minLength={6} autoComplete="new-password" />
          </div>
          {state.error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error.message}
            </div>
          )}
          <Button type="submit" className="w-full" loading={pending}>
            Salvar nova senha
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}