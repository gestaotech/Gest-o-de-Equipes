import { NextResponse } from "next/server";
import { processWebhook } from "@/lib/billing";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { payload, signature } = body;

    if (!payload || !signature) {
      return NextResponse.json(
        { error: "Missing payload or signature" },
        { status: 400 }
      );
    }

    await processWebhook(payload, signature);

    return NextResponse.json({ status: "success" });
  } catch {
    console.error("Webhook processing error:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}