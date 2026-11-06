import { NextRequest, NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth";
import { requireDataScope } from "@/server/scope";
import { prisma } from "@/lib/prisma";

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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno." },
      { status: error.statusCode ?? 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const body = await request.json();

    const incident = await prisma.securityIncident.create({
      data: {
        organizationId: scope.orgId,
        title: body.title,
        description: body.description,
        category: body.category,
        severity: body.severity,
        systemsAffected: body.systemsAffected,
        dataCompromised: body.dataCompromised,
        subjectsAffected: body.subjectsAffected,
        organizationsAffected: body.organizationsAffected,
        containmentMeasures: body.containmentMeasures,
        responsePlan: body.responsePlan,
        responsibleId: body.responsibleId || session.sub,
        evidenceUrl: body.evidenceUrl,
      },
      include: {
        responsible: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ incident }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno." },
      { status: error.statusCode ?? 500 }
    );
  }
}
