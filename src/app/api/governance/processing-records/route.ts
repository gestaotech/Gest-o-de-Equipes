import { NextRequest, NextResponse } from "next/server";
import { requireDataScope } from "@/server/scope";
import { guardRole } from "@/server/guards";
import { prisma } from "@/lib/prisma";
import { DataCategory, DataSubjectCategory } from "@prisma/client";
import { AppError } from "@/lib/errors";

export async function GET() {
  try {
    const scope = await requireDataScope();
    guardRole(scope.membership, "ADMIN");
    const records = await prisma.processingRecord.findMany({
      where: { organizationId: scope.orgId },
      orderBy: { createdAt: "desc" },
    });
    const response = NextResponse.json({ records });
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

    const requiredText = ["name", "purpose", "legalBasis", "sharing"] as const;
    if (requiredText.some((key) => typeof body[key] !== "string" || !(body[key] as string).trim())) {
      return NextResponse.json({ error: "Preencha os campos obrigatórios do registro." }, { status: 400 });
    }
    const legalBases = ["CONSENT", "LEGAL_OBLIGATION", "PUBLIC_POLICY", "CONTRACT", "LEGITIMATE_INTEREST", "VITAL_INTEREST", "LEGAL_EXERCISE", "OTHER"];
    const sharingTypes = ["NONE", "THIRD_PARTY_PROCESSOR", "CONTROLLER", "AUTHORITY", "OTHER"];
    const dataCategories = ["IDENTIFICATION", "CONTACT", "EMPLOYMENT", "AUTHENTICATION", "DEVICE", "BEHAVIORAL", "FINANCIAL", "HEALTH", "BIOMETRIC", "OTHER"];
    const subjectCategories = ["EMPLOYEE", "MEMBER", "CUSTOMER", "PARTNER", "OTHER"];
    const validArray = (value: unknown, allowed: string[]) =>
      value === undefined || (Array.isArray(value) && value.every((item) => typeof item === "string" && allowed.includes(item)));
    if (
      !legalBases.includes(body.legalBasis as string) ||
      !sharingTypes.includes(body.sharing as string) ||
      !validArray(body.dataCategory, dataCategories) ||
      !validArray(body.subjectCategory, dataCategories) ||
      !validArray(body.dataSubjects, subjectCategories)
    ) {
      return NextResponse.json({ error: "Há categorias ou bases legais inválidas no registro." }, { status: 400 });
    }
    const record = await prisma.processingRecord.create({
      data: {
        organizationId: scope.orgId,
        name: (body.name as string).trim(),
        description: typeof body.description === "string" ? body.description : null,
        purpose: (body.purpose as string).trim(),
        legalBasis: body.legalBasis as "CONSENT" | "LEGAL_OBLIGATION" | "PUBLIC_POLICY" | "CONTRACT" | "LEGITIMATE_INTEREST" | "VITAL_INTEREST" | "LEGAL_EXERCISE" | "OTHER",
        dataCategory: ((body.dataCategory as string[] | undefined) ?? []) as DataCategory[],
        subjectCategory: ((body.subjectCategory as string[] | undefined) ?? []) as DataCategory[],
        dataSubjects: ((body.dataSubjects as string[] | undefined) ?? []) as DataSubjectCategory[],
        sharing: body.sharing as "NONE" | "THIRD_PARTY_PROCESSOR" | "CONTROLLER" | "AUTHORITY" | "OTHER",
        sharedWith: typeof body.sharedWith === "string" ? body.sharedWith : null,
        retentionPeriod: typeof body.retentionPeriod === "string" ? body.retentionPeriod : null,
        securityMeasures: typeof body.securityMeasures === "string" ? body.securityMeasures : null,
        dpoResponsible: typeof body.dpoResponsible === "string" ? body.dpoResponsible : null,
      },
    });

    const response = NextResponse.json({ record }, { status: 201 });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const statusCode = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
