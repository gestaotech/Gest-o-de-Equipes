import { Logo } from "@/components/ui/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 via-background to-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(closest-side,rgba(59,130,246,0.12),transparent)]"
      />
      <div className="mb-6">
        <Logo />
      </div>
      <div className="relative w-full max-w-md">{children}</div>
      <p className="mt-8 text-xs text-muted-foreground">
        © {new Date().getFullYear()} TeamFlow. Todos os direitos reservados.
      </p>
    </div>
  );
}