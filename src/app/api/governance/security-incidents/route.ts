import { NextRequest, NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth";
import { requireDataScope } from "@/server/scope";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const incidents = await prisma.securityIncident.findMany({
      where: { organizationId: scope.orgId },
      include: {
        responsible: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ incidents });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const statusCode = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const body: Record<string, unknown> = await request.json();

    const incident = await prisma.securityIncident.create({
      data: {
        organizationId: scope.orgId,
        title: body.title as string,
        description: body.description as string,
        category: body.category as string,
        severity: body.severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
        systemsAffected: body.systemsAffected as string | undefined,
        dataCompromised: body.dataCompromised as string | undefined,
        subjectsAffected: body.subjectsAffected as number | undefined,
        organizationsAffected: body.organizationsAffected as number | undefined,
        containmentMeasures: body.containmentMeasures as string | undefined,
        responsePlan: body.responsePlan as string | undefined,
        responsibleId: (body.responsibleId as string) || scope.membership.id,
        evidenceUrl: body.evidenceUrl as string | undefined,
      },
      include: {
        responsible: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ incident }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const statusCode = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
