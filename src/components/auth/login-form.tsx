"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login, completeTwoFactorLogin } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/types";

type Step = "password" | "totp";

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("password");
  const [tempToken, setTempToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function redirectAfterLogin(hasOrg?: boolean) {
    router.push(hasOrg ? "/dashboard" : "/criar-org");
    router.refresh();
  }

  function submitPassword(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = (await login({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      })) as ActionResult<{ hasOrg?: boolean; twoFactorRequired?: boolean; tempToken?: string }>;

      if (!res.success) {
        const message = res.error?.message ?? "Erro ao entrar.";
        setError(message);
        toast(message, "error");
        return;
      }

      if (res.data?.twoFactorRequired && res.data.tempToken) {
        setTempToken(res.data.tempToken);
        setStep("totp");
        setError(null);
        return;
      }

      toast("Login realizado!");
      redirectAfterLogin(res.data?.hasOrg);
    });
  }

  function submitTotp(formData: FormData) {
    setError(null);
    const token = String(formData.get("token") ?? "").trim();
    if (!token) {
      setError("Informe o código de verificação.");
      return;
    }

    startTransition(async () => {
      const res = (await completeTwoFactorLogin({ tempToken, token })) as ActionResult<{
        hasOrg?: boolean;
      }>;

      if (!res.success) {
        const message = res.error?.message ?? "Código inválido.";
        setError(message);
        toast(message, "error");
        return;
      }

      toast("Login realizado!");
      redirectAfterLogin(res.data?.hasOrg);
    });
  }

  if (step === "totp") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verificação em duas etapas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Digite o código de 6 dígitos do seu aplicativo autenticador ou um código de backup.
          </p>
        </CardHeader>
        <CardContent>
          <form action={submitTotp} className="space-y-4">
            <div>
              <Label htmlFor="token">Código de verificação</Label>
              <Input
                id="token"
                name="token"
                inputMode="text"
                autoComplete="one-time-code"
                placeholder="000000"
                required
              />
            </div>
            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            <Button type="submit" className="w-full" loading={pending}>
              Verificar e entrar
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep("password");
                setTempToken("");
                setError(null);
              }}
            >
              Voltar
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <p className="text-sm text-muted-foreground">Acesse sua conta TeamFlow.</p>
      </CardHeader>
      <CardContent>
        <form action={submitPassword} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" placeholder="voce@empresa.com" />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" placeholder="••••••••" />
          </div>
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <Button type="submit" className="w-full" loading={pending}>
            Entrar
          </Button>
        </form>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Esqueceu a senha?{" "}
          <Link href="/recuperar" className="font-medium text-blue-600 hover:underline">
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
