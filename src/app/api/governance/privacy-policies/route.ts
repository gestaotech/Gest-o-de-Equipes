import { NextRequest, NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth";
import { requireDataScope } from "@/server/scope";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const policies = await prisma.privacyPolicy.findMany({
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

    if (body.isActive) {
      await prisma.privacyPolicy.updateMany({
        where: { organizationId: scope.orgId },
        data: { isActive: false },
      });
    }

    const policy = await prisma.privacyPolicy.create({
      data: {
        organizationId: scope.orgId,
        title: body.title,
        version: body.version,
        content: body.content,
        effectiveFrom: new Date(body.effectiveFrom),
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
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
