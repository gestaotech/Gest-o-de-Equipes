import { NextRequest, NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth";
import { requireDataScope } from "@/server/scope";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const records = await prisma.processingRecord.findMany({
      where: { organizationId: scope.orgId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ records });
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

    const record = await prisma.processingRecord.create({
      data: {
        organizationId: scope.orgId,
        name: body.name,
        description: body.description,
        purpose: body.purpose,
        legalBasis: body.legalBasis,
        dataCategory: body.dataCategory,
        subjectCategory: body.subjectCategory,
        dataSubjects: body.dataSubjects,
        sharing: body.sharing,
        sharedWith: body.sharedWith,
        retentionPeriod: body.retentionPeriod,
        securityMeasures: body.securityMeasures,
        dpoResponsible: body.dpoResponsible,
      },
    });

    return NextResponse.json({ record }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno." },
      { status: error.statusCode ?? 500 }
    );
  }
}
