import { NextRequest, NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth";
import { requireDataScope } from "@/server/scope";
import { AppError } from "@/lib/errors";
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
        const response = NextResponse.json(result);
        response.headers.set("Cache-Control", "private, no-store");
        return response;
      }
      case "export": {
        const userId = searchParams.get("userId");
        if (!userId) {
          return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
        }
        const result = await exportUserData(userId);
        const response = NextResponse.json(result);
        response.headers.set("Cache-Control", "private, no-store");
        return response;
      }
      case "anonymize":
      case "delete": {
        return NextResponse.json(
          { error: "Operações de anonimização e exclusão não podem ser executadas por GET." },
          { status: 405 }
        );
      }
      default: {
        return NextResponse.json({ error: "Ação não especificada." }, { status: 400 });
      }
    }
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

    const result = await createLGPDRequest({
      ...body,
      // userId e requesterId são definidos na action com base na sessão
    });

    const response = NextResponse.json(result, { status: 201 });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const statusCode = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
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
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const statusCode = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const statusCode = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
