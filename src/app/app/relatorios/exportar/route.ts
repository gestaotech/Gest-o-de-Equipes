import { NextResponse } from "next/server";
import { requireSessionApi, getActiveOrg } from "@/lib/auth";
import { permits } from "@/lib/rbac";
import { AppError } from "@/lib/errors";
import { indicatorScopeSchema } from "@/lib/validations";
import { periodRange } from "@/lib/indicator-metrics";
import { reportRows, exportCsv, type ReportKind } from "@/lib/reports";
import type { IndicatorScope } from "@/lib/indicator-queries";

export const dynamic = "force-dynamic";

const KINDS: ReportKind[] = ["tasks", "projects", "teams", "members", "goals"];

export async function GET(req: Request) {
  try {
    const session = await requireSessionApi();
    const org = await getActiveOrg(session);
    if (!org) {
      throw new AppError("NO_ORG", "Você ainda não possui uma organização.", 404);
    }
    if (org.membership.status !== "ATIVO") {
      throw new AppError("FORBIDDEN", "Seu acesso a esta organização está desativado.", 403);
    }
    if (!permits(org.role, "reports.export")) {
      throw new AppError("FORBIDDEN", "Sem permissão para exportar relatórios.", 403);
    }

    const url = new URL(req.url);
    const one = (v: string | null) => v ?? undefined;
    const kindRaw = url.searchParams.get("kind");
    const kind: ReportKind = (KINDS as string[]).includes(kindRaw ?? "")
      ? (kindRaw as ReportKind)
      : "tasks";

    const parsed = indicatorScopeSchema.safeParse({
      period: one(url.searchParams.get("period")),
      from: one(url.searchParams.get("from")),
      to: one(url.searchParams.get("to")),
      teamId: one(url.searchParams.get("teamId")),
      departmentId: one(url.searchParams.get("departmentId")),
      memberId: one(url.searchParams.get("memberId")),
      projectId: one(url.searchParams.get("projectId")),
      status: one(url.searchParams.get("status")),
      priority: one(url.searchParams.get("priority")),
    });
    const f = parsed.success ? parsed.data : {};
    const period = (f.period ?? "30d") as IndicatorScope["period"];
    const range = periodRange(period, f.from, f.to);
    const scope: IndicatorScope = { orgId: org.id, period, ...f };

    const rows = await reportRows(kind, scope, range);
    const csv = exportCsv(kind, rows);
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="relatorio-${kind}-${date}.csv"`,
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status ?? 400 }
      );
    }
    console.error("[export]", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}