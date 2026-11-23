import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { createCheckoutSession, cancelSubscription } = await import("@/server/checkout-actions");
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case "createCheckout":
        return NextResponse.json(await createCheckoutSession(params));
      case "cancelSubscription":
        return NextResponse.json(await cancelSubscription());
      default:
        return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
    }
  } catch (error) {
    console.error("[billing:checkout]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function GET() {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return NextResponse.json({ subscription: null });
  }
  try {
    const { getSubscriptionStatus } = await import("@/server/checkout-actions");
    return NextResponse.json(await getSubscriptionStatus());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    if (message.includes("Session") || message.includes("AUTH_SECRET")) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    console.error("[billing:status]", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}