import { NextRequest, NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth";
import { requireDataScope } from "@/server/scope";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const consents = await prisma.consent.findMany({
      where: { userId: session.sub, organizationId: scope.orgId },
      include: { policy: { select: { id: true, title: true, version: true } } },
      orderBy: { grantedAt: "desc" },
    });

    return NextResponse.json({ consents });
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

    const policy = await prisma.privacyPolicy.findFirst({
      where: {
        id: body.policyId as string,
        organizationId: scope.orgId,
        isActive: true,
      },
    });
    if (!policy) {
      return NextResponse.json({ error: "Política de privacidade ativa não encontrada." }, { status: 404 });
    }

    const consent = await prisma.consent.upsert({
      where: { userId_policyId: { userId: session.sub, policyId: body.policyId as string } },
      create: {
        organizationId: scope.orgId,
        userId: session.sub,
        policyId: body.policyId as string,
        version: policy.version,
        ipAddress: body.ipAddress as string | undefined,
        userAgent: body.userAgent as string | undefined,
      },
      update: {
        version: policy.version,
        grantedAt: new Date(),
        revokedAt: null,
        ipAddress: body.ipAddress as string | undefined,
        userAgent: body.userAgent as string | undefined,
      },
    });

    return NextResponse.json({ consent }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const statusCode = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
