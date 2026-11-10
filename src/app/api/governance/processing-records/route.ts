import { NextRequest, NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth";
import { requireDataScope } from "@/server/scope";
import { prisma } from "@/lib/prisma";
import { DataCategory, DataSubjectCategory } from "@prisma/client";
import { AppError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const records = await prisma.processingRecord.findMany({
      where: { organizationId: scope.orgId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ records });
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

    const record = await prisma.processingRecord.create({
      data: {
        organizationId: scope.orgId,
        name: body.name as string,
        description: body.description as string | undefined,
        purpose: body.purpose as string,
        legalBasis: body.legalBasis as "CONSENT" | "LEGAL_OBLIGATION" | "PUBLIC_POLICY" | "CONTRACT" | "LEGITIMATE_INTEREST" | "VITAL_INTEREST" | "LEGAL_EXERCISE" | "OTHER",
        dataCategory: ((body.dataCategory as string[] | undefined) ?? []) as DataCategory[],
        subjectCategory: ((body.subjectCategory as string[] | undefined) ?? []) as DataCategory[],
        dataSubjects: (body.dataSubjects as unknown) as DataSubjectCategory[] | undefined,
        sharing: body.sharing as "NONE" | "THIRD_PARTY_PROCESSOR" | "CONTROLLER" | "AUTHORITY" | "OTHER",
        sharedWith: body.sharedWith as string | undefined,
        retentionPeriod: body.retentionPeriod as string | undefined,
        securityMeasures: body.securityMeasures as string | undefined,
        dpoResponsible: body.dpoResponsible as string | undefined,
      },
    });

    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const statusCode = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
