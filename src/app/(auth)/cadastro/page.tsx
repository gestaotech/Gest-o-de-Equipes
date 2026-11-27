import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Acesso restrito" };

export default async function SignupPage() {
  const session = await getSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
      <h1 className="text-xl font-semibold">Cadastro por convite</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        A criação de contas por conta própria não está disponível.
        Para acessar o Gestão de Equipes, solicite ao administrador da sua
        organização que cadastre seu usuário e envie o convite de primeiro acesso.
      </p>
      <Link
        href="/login"
        className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Ir para o login
      </Link>
    </div>
  );
}
