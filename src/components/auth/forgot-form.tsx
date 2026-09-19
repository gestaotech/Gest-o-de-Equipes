"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestReset } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionResult } from "@/lib/types";

export function ForgotForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult, formData: FormData) => {
      return (await requestReset({
        email: String(formData.get("email") ?? ""),
      })) as ActionResult<{ resetUrl?: string | null }>;
    },
    { success: false }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recuperar senha</CardTitle>
        <p className="text-sm text-muted-foreground">
          Informe seu e-mail e enviaremos um link de redefinição.
        </p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" placeholder="voce@empresa.com" />
          </div>
          {state.success && (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Se o e-mail existir, enviamos o link de redefinição.
            </div>
          )}
          {(!state.success || state.success) && state.error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error.message}
            </div>
          )}
          <Button type="submit" className="w-full" loading={pending}>
            Enviar link
          </Button>
          {state.success && (state as ActionResult & { data?: { resetUrl?: string | null } }).data?.resetUrl && (
            <div className="rounded-lg border border-dashed bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Modo dev: use o link{" "}
              <a
                href={(state as any).data.resetUrl}
                className="font-mono text-blue-600 underline break-all"
              >
                {(state as any).data.resetUrl}
              </a>
            </div>
          )}
        </form>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Lembrou a senha?{" "}
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
            Entrar
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}