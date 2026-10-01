import { NextResponse } from "next/server";
import { createSubscription, createCheckout } from "@/lib/billing";

export function GET() {
  // Health check
  return NextResponse.json({ status: "ok" });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action = "createSubscription", organizationId, planId, cycle } = body;

    if (!organizationId || !planId || !cycle) {
      return NextResponse.json(
        { error: "Missing required fields: organizationId, planId, cycle" },
        { status: 400 }
      );
    }

    switch (action) {
      case "createSubscription": {
        const result = await createSubscription({
          organizationId,
          planId,
          cycle: cycle as "MONTHLY" | "YEARLY",
        });
        return NextResponse.json(result);
      }

      case "createCheckout": {
        const result = await createCheckout({
          organizationId,
          planId,
          cycle: cycle as "MONTHLY" | "YEARLY",
        });
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Billing API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}