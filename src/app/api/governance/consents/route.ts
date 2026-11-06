import { NextRequest, NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth";
import { requireDataScope } from "@/server/scope";
import { prisma } from "@/lib/prisma";

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

    const policy = await prisma.privacyPolicy.findFirst({
      where: { id: body.policyId, organizationId: scope.orgId, isActive: true },
    });
    if (!policy) {
      return NextResponse.json({ error: "Política de privacidade ativa não encontrada." }, { status: 404 });
    }

    const consent = await prisma.consent.upsert({
      where: { userId_policyId: { userId: session.sub, policyId: body.policyId } },
      create: {
        organizationId: scope.orgId,
        userId: session.sub,
        policyId: body.policyId,
        version: policy.version,
        ipAddress: body.ipAddress,
        userAgent: body.userAgent,
      },
      update: {
        version: policy.version,
        grantedAt: new Date(),
        revokedAt: null,
        ipAddress: body.ipAddress,
        userAgent: body.userAgent,
      },
    });

    return NextResponse.json({ consent }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno." },
      { status: error.statusCode ?? 500 }
    );
  }
}
