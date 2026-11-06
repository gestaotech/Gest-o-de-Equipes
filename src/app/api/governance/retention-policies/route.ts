import { NextRequest, NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth";
import { requireDataScope } from "@/server/scope";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const policies = await prisma.retentionPolicy.findMany({
      where: { organizationId: scope.orgId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ policies });
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

    const policy = await prisma.retentionPolicy.create({
      data: {
        organizationId: scope.orgId,
        entityType: body.entityType,
        entityField: body.entityField,
        condition: body.condition,
        action: body.action,
        retentionDays: body.retentionDays,
        legalBasis: body.legalBasis,
        isActive: body.isActive,
      },
    });

    return NextResponse.json({ policy }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno." },
      { status: error.statusCode ?? 500 }
    );
  }
}
