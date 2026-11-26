import { NextRequest, NextResponse } from "next/server";
import { requireDataScope } from "@/server/scope";
import { guardRole } from "@/server/guards";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { RETENTION_ACTIONS, RETENTION_ENTITY_TYPES, MIN_RETENTION_DAYS } from "@/lib/retention";

export async function GET() {
  try {
    const scope = await requireDataScope();
    guardRole(scope.membership, "ADMIN");
    const policies = await prisma.retentionPolicy.findMany({
      where: { organizationId: scope.orgId },
      orderBy: { createdAt: "desc" },
    });
    const response = NextResponse.json({ policies });
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

    const entityType = typeof body.entityType === "string" ? body.entityType : "";
    const action = typeof body.action === "string" ? body.action : "";
    const condition = typeof body.condition === "string" ? body.condition.trim() : "";
    const retentionDays = body.retentionDays;
    if (
      !(RETENTION_ENTITY_TYPES as readonly string[]).includes(entityType) ||
      !(RETENTION_ACTIONS as readonly string[]).includes(action) ||
      !condition ||
      !Number.isInteger(retentionDays) || (retentionDays as number) < MIN_RETENTION_DAYS
    ) {
      return NextResponse.json({
        error: `Informe um tipo de dado permitido, ação DELETE, condição e prazo mínimo de ${MIN_RETENTION_DAYS} dias.`,
      }, { status: 400 });
    }

    const policy = await prisma.retentionPolicy.create({
      data: {
        organizationId: scope.orgId,
        entityType,
        entityField: typeof body.entityField === "string" ? body.entityField : null,
        condition,
        action,
        retentionDays: retentionDays as number,
        legalBasis: typeof body.legalBasis === "string" ? body.legalBasis : null,
        isActive: body.isActive === true,
      },
    });

    const response = NextResponse.json({ policy }, { status: 201 });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const statusCode = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
