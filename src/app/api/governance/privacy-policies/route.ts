import { NextRequest, NextResponse } from "next/server";
import { requireDataScope } from "@/server/scope";
import { guardRole } from "@/server/guards";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

export async function GET() {
  try {
    const scope = await requireDataScope();
    const policies = await prisma.privacyPolicy.findMany({
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

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const version = typeof body.version === "string" ? body.version.trim() : "";
    const content = typeof body.content === "string" ? body.content : "";
    const effectiveFromValue = typeof body.effectiveFrom === "string" ? body.effectiveFrom : "";
    if (title.length < 2 || !version || !content.trim() || !effectiveFromValue) {
      return NextResponse.json({ error: "Preencha título, versão, conteúdo e data de vigência." }, { status: 400 });
    }
    const effectiveFrom = new Date(effectiveFromValue);
    const effectiveTo = typeof body.effectiveTo === "string" && body.effectiveTo
      ? new Date(body.effectiveTo)
      : null;
    if (
      Number.isNaN(effectiveFrom.getTime()) ||
      (effectiveTo && Number.isNaN(effectiveTo.getTime())) ||
      (effectiveTo && effectiveTo < effectiveFrom)
    ) {
      return NextResponse.json({ error: "Data de vigência inválida." }, { status: 400 });
    }

    const policy = await prisma.$transaction(async (tx) => {
      if (body.isActive === true) {
        await tx.privacyPolicy.updateMany({
          where: { organizationId: scope.orgId },
          data: { isActive: false },
        });
      }
      return tx.privacyPolicy.create({
        data: {
          organizationId: scope.orgId,
          title,
          version,
          content,
          effectiveFrom,
          effectiveTo,
          isActive: body.isActive === true,
        },
      });
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
