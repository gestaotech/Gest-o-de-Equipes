import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { getLGPDRequest } from "@/server/lgpd-actions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;
    const result = await getLGPDRequest(requestId);
    const response = NextResponse.json(result);
    response.headers.set("Cache-Control", "private, no-store");
    void request;
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const statusCode = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
