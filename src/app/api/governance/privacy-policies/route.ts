import { NextRequest, NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth";
import { requireDataScope } from "@/server/scope";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const policies = await prisma.privacyPolicy.findMany({
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

    if (body.isActive) {
      await prisma.privacyPolicy.updateMany({
        where: { organizationId: scope.orgId },
        data: { isActive: false },
      });
    }

    const policy = await prisma.privacyPolicy.create({
      data: {
        organizationId: scope.orgId,
        title: body.title as string,
        version: body.version as string,
        content: body.content as string,
        effectiveFrom: new Date(body.effectiveFrom as string),
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo as string) : null,
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
