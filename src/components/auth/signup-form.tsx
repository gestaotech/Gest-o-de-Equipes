"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { register } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/types";

export function SignupForm() {
  const router = useRouter();

  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => {
      const res = (await register({
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      })) as ActionResult;
      if (res.success) {
        toast("Conta criada!");
        setTimeout(() => {
          router.push("/criar-org");
          router.refresh();
        }, 200);
      } else {
        toast(res.error?.message ?? "Erro ao criar conta.", "error");
      }
      return res;
    },
    { success: false }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <p className="text-sm text-muted-foreground">
          Comece grátis. Sem cartão de crédito.
        </p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome completo</Label>
            <Input id="name" name="name" required autoComplete="name" placeholder="Seu nome" />
          </div>
          <div>
            <Label htmlFor="email">E-mail corporativo</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" placeholder="voce@empresa.com" />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" placeholder="Mínimo 6 caracteres" />
            <p className="mt-1 text-xs text-muted-foreground">Mínimo de 6 caracteres.</p>
          </div>
          {state.error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error.message}
            </div>
          )}
          <Button type="submit" className="w-full" loading={pending}>
            Criar minha conta
          </Button>
        </form>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
            Entrar
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}