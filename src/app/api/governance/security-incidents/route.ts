import { NextRequest, NextResponse } from "next/server";
import { requireDataScope } from "@/server/scope";
import { guardRole, validateOrgReferences } from "@/server/guards";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export async function GET() {
  try {
    const scope = await requireDataScope();
    guardRole(scope.membership, "ADMIN");
    const incidents = await prisma.securityIncident.findMany({
      where: { organizationId: scope.orgId },
      include: {
        responsible: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const response = NextResponse.json({ incidents });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const statusCode = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireDataScope();
    guardRole(scope.membership, "ADMIN");
    const body: Record<string, unknown> = await request.json();

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const severity = typeof body.severity === "string" ? body.severity : "";
    if (
      !title ||
      !description ||
      !category ||
      !(SEVERITIES as readonly string[]).includes(severity)
    ) {
      return NextResponse.json({ error: "Informe título, descrição, categoria e gravidade válidos." }, { status: 400 });
    }

    const responsibleId = typeof body.responsibleId === "string" && body.responsibleId
      ? body.responsibleId
      : scope.membership.id;
    await validateOrgReferences(scope.orgId, { members: [responsibleId] });

    const numericFields = [body.subjectsAffected, body.organizationsAffected];
    if (numericFields.some((value) => value !== undefined && (!Number.isInteger(value) || (value as number) < 0))) {
      return NextResponse.json({ error: "As quantidades afetadas devem ser números inteiros não negativos." }, { status: 400 });
    }

    const incident = await prisma.securityIncident.create({
      data: {
        organizationId: scope.orgId,
        title,
        description,
        category,
        severity: severity as (typeof SEVERITIES)[number],
        systemsAffected: typeof body.systemsAffected === "string" ? body.systemsAffected : null,
        dataCompromised: typeof body.dataCompromised === "string" ? body.dataCompromised : null,
        subjectsAffected: typeof body.subjectsAffected === "number" ? body.subjectsAffected : null,
        organizationsAffected: typeof body.organizationsAffected === "number" ? body.organizationsAffected : null,
        containmentMeasures: typeof body.containmentMeasures === "string" ? body.containmentMeasures : null,
        responsePlan: typeof body.responsePlan === "string" ? body.responsePlan : null,
        responsibleId,
        evidenceUrl: typeof body.evidenceUrl === "string" ? body.evidenceUrl : null,
      },
      include: {
        responsible: { select: { id: true, name: true, email: true } },
      },
    });

    const response = NextResponse.json({ incident }, { status: 201 });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const statusCode = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
