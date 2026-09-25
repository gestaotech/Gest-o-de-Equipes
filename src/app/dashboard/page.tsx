import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { activityLabel } from "@/lib/queries";
import { formatRelative } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { getSession, getActiveOrg } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    // In a real app, you'd redirect to login, but for simplicity we'll show empty state
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="col-span-2">
          <Card>
            <CardContent className="p-5">
              <p className="text-center text-muted-foreground">
                Por favor, faça login para ver a atividade recente.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const org = await getActiveOrg(session);
  if (!org) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="col-span-2">
          <Card>
            <CardContent className="p-5">
              <p className="text-center text-muted-foreground">
                Nenhuma organização ativa encontrada.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Fetch recent activity for the organization
  const activity = await prisma.activityLog.findMany({
    where: {
      organizationId: org.id
    },
    include: {
      user: {
        select: {
          name: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 10 // Show only the 10 most recent activities
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="col-span-2">
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Atividade recente</h3>
              <Link href="/app/atividade" className="text-sm font-medium text-blue-600 hover:underline">
                Ver todas
              </Link>
            </div>
            {activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Ainda não há atividades registradas.
              </p>
            ) : (
              <ul className="space-y-3">
                {activity.map((log) => (
                  <li key={log.id} className="flex items-start gap-3">
                    <Avatar name={log.user?.name ?? "?"} className="h-7 w-7 text-[10px]" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="text-foreground">
                        <span className="font-medium">{log.user?.name ?? "Sistema"}</span>{" "}
                        <span className="text-muted-foreground">
                          {activityLabel[log.action] ?? log.action}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">{formatRelative(log.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}