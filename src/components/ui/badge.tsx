import * as React from "react";
import { cn } from "@/lib/utils";

type Variant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "destructive";

const variants: Record<Variant, string> = {
  default: "bg-blue-100 text-blue-800",
  secondary: "bg-secondary text-secondary-foreground",
  outline: "border text-muted-foreground",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  destructive: "bg-red-100 text-red-800",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

const STATUS_LABEL: Record<string, string> = {
  PLANEJAMENTO: "Planejamento",
  EM_ANDAMENTO: "Em andamento",
  PAUSADO: "Pausado",
  CONCLUIDO: "Concluído",
  BACKLOG: "Backlog",
  TODO: "A fazer",
  IN_PROGRESS: "Em andamento",
  IN_REVIEW: "Em revisão",
  DONE: "Concluída",
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export function statusBadge(status: string) {
  const label = STATUS_LABEL[status] ?? status;
  if (["DONE", "CONCLUIDO", "ATIVO"].includes(status))
    return <Badge variant="success">{label}</Badge>;
  if (["PRIORITY_HIGH", "HIGH", "URGENT"].includes(status))
    return <Badge variant="warning">{label}</Badge>;
  if (["URGENT"].includes(status)) return <Badge variant="destructive">{label}</Badge>;
  if (["PAUSADO", "BACKLOG"].includes(status))
    return <Badge variant="secondary">{label}</Badge>;
  return <Badge>{label}</Badge>;
}

export function statusVariant(status: string): Variant {
  if (["DONE", "CONCLUIDO", "ATIVO"].includes(status)) return "success";
  if (["URGENT"].includes(status)) return "destructive";
  if (["HIGH", "EM_ANDAMENTO", "IN_PROGRESS"].includes(status)) return "warning";
  if (["PAUSADO", "BACKLOG", "INATIVO"].includes(status)) return "secondary";
  return "default";
}