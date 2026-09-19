"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/types";

export function LoginForm() {
  const router = useRouter();

  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => {
      const res = (await login({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      })) as ActionResult<{ hasOrg: boolean }>;
      if (res.success) {
        toast("Login realizado!");
        setTimeout(() => {
          router.push(res.data?.hasOrg ? "/dashboard" : "/criar-org");
          router.refresh();
        }, 200);
      } else {
        toast(res.error?.message ?? "Erro ao entrar.", "error");
      }
      return res;
    },
    { success: false }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <p className="text-sm text-muted-foreground">
          Acesse sua conta TeamFlow.
        </p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" placeholder="voce@empresa.com" />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" placeholder="••••••••" />
          </div>
          {state.error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error.message}
            </div>
          )}
          <Button type="submit" className="w-full" loading={pending}>
            Entrar
          </Button>
        </form>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Esqueceu a senha?{" "}
          <Link href="/recuperar-senha" className="font-medium text-blue-600 hover:underline">
            Recuperar
          </Link>
        </div>
        <div className="mt-2 text-center text-sm text-muted-foreground">
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="font-medium text-blue-600 hover:underline">
            Criar gratuitamente
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}