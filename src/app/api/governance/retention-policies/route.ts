import { NextRequest, NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth";
import { requireDataScope } from "@/server/scope";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const policies = await prisma.retentionPolicy.findMany({
      where: { organizationId: scope.orgId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ policies });
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

    const policy = await prisma.retentionPolicy.create({
      data: {
        organizationId: scope.orgId,
        entityType: body.entityType as string,
        entityField: body.entityField as string | undefined,
        condition: body.condition as string,
        action: body.action as string,
        retentionDays: body.retentionDays as number,
        legalBasis: body.legalBasis as string | undefined,
        isActive: body.isActive === true,
      },
    });

    return NextResponse.json({ policy }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const statusCode = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
