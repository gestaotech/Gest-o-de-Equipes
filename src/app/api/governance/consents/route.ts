import { NextRequest, NextResponse } from "next/server";
import { requireDataScope } from "@/server/scope";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

export async function GET() {
  try {
    const scope = await requireDataScope();
    const consents = await prisma.consent.findMany({
      where: { userId: scope.session.sub, organizationId: scope.orgId },
      include: { policy: { select: { id: true, title: true, version: true } } },
      orderBy: { grantedAt: "desc" },
    });
    return NextResponse.json({ consents, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const statusCode = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireDataScope();
    const body: Record<string, unknown> = await request.json();
    if (typeof body.policyId !== "string" || !body.policyId.trim()) {
      return NextResponse.json({ error: "Política inválida." }, { status: 400 });
    }

    const policy = await prisma.privacyPolicy.findFirst({
      where: {
        id: body.policyId,
        organizationId: scope.orgId,
        isActive: true,
      },
    });
    if (!policy) {
      return NextResponse.json({ error: "Política de privacidade ativa não encontrada." }, { status: 404 });
    }

    const forwarded = request.headers.get("x-forwarded-for");
    const ipAddress = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
    const userAgent = request.headers.get("user-agent") || null;

    const consent = await prisma.consent.upsert({
      where: { userId_policyId: { userId: scope.session.sub, policyId: policy.id } },
      create: {
        organizationId: scope.orgId,
        userId: scope.session.sub,
        policyId: policy.id,
        version: policy.version,
        ipAddress,
        userAgent,
      },
      update: {
        version: policy.version,
        grantedAt: new Date(),
        revokedAt: null,
        ipAddress,
        userAgent,
      },
    });

    const response = NextResponse.json({ consent }, { status: 201 });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const statusCode = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
