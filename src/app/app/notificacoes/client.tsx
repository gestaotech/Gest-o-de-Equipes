"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Megaphone, CalendarCheck, AlertCircle } from "lucide-react";
import { markNotificationsRead } from "@/server/work-actions";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { cn, formatRelative } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

type Notif = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  readAt: Date | null;
  createdAt: Date;
};

const typeIcon: Record<string, React.ReactNode> = {
  announcement: <Megaphone className="h-4 w-4 text-blue-600" />,
  event: <CalendarCheck className="h-4 w-4 text-emerald-600" />,
  warning: <AlertCircle className="h-4 w-4 text-amber-600" />,
};

export function NotificationsClient({
  initialUnread,
  notifications,
}: {
  initialUnread: number;
  notifications: Notif[];
}) {
  const router = useRouter();
  const [unread, setUnread] = useState(initialUnread);
  const [busy, setBusy] = useState(false);

  async function markAll() {
    setBusy(true);
    const res: any = await markNotificationsRead();
    setBusy(false);
    if (res.success) {
      setUnread(0);
      toast("Todas as notificações marcadas como lidas.");
      router.refresh();
    } else {
      toast(res.error?.message ?? "Erro.", "error");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notificações"
        description={unread > 0 ? `${unread} não lida(s).` : "Tudo em dia."}
        actions={
          unread > 0 && (
            <Button variant="outline" onClick={markAll} loading={busy}>
              <CheckCheck className="h-4 w-4" /> Marcar todas como lidas
            </Button>
          )
        }
      />
      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title="Nenhuma notificação"
          description="Avisos, tarefas e eventos aparecerão aqui."
        />
      ) : (
        <Card className="divide-y p-0">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-3 p-4",
                !n.readAt && "bg-blue-50/50"
              )}
            >
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                {typeIcon[n.type] ?? <Bell className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{n.title}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelative(n.createdAt)}
                  </span>
                </div>
                {n.message && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                )}
              </div>
              {!n.readAt && (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}