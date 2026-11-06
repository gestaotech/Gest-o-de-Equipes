import { NextRequest, NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth";
import { requireDataScope } from "@/server/scope";
import {
  createLGPDRequest,
  listLGPDRequests,
  updateLGPDRequestStatus,
  getLGPDRequest,
  exportUserData,
  anonymizeUserData,
  deleteUserData,
} from "@/server/lgpd-actions";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    switch (action) {
      case "list": {
        const result = await listLGPDRequests();
        return NextResponse.json(result);
      }
      case "export": {
        const userId = searchParams.get("userId");
        if (!userId) {
          return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
        }
        const result = await exportUserData(userId);
        return NextResponse.json(result);
      }
      case "anonymize": {
        const userId = searchParams.get("userId");
        if (!userId) {
          return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
        }
        const result = await anonymizeUserData(userId);
        return NextResponse.json(result);
      }
      case "delete": {
        const userId = searchParams.get("userId");
        if (!userId) {
          return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
        }
        const result = await deleteUserData(userId);
        return NextResponse.json(result);
      }
      default: {
        return NextResponse.json({ error: "Ação não especificada." }, { status: 400 });
      }
    }
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

    const result = await createLGPDRequest({
      ...body,
      // userId e requesterId são definidos na action com base na sessão
    } as any);

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno." },
      { status: error.statusCode ?? 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const body = await request.json();
    const { requestId, status, rejectionReason, comment } = body;

    if (!requestId || !status) {
      return NextResponse.json(
        { error: "requestId e status são obrigatórios." },
        { status: 400 }
      );
    }

    const result = await updateLGPDRequestStatus({
      requestId,
      status,
      rejectionReason,
      comment,
    } as any);

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno." },
      { status: error.statusCode ?? 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
    }

    const result = await deleteUserData(userId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno." },
      { status: error.statusCode ?? 500 }
    );
  }
}
