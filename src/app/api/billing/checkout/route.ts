import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// A integração de cobrança online foi desativada temporariamente.
// Não encaminhar chamadas para ações antigas do Asaas.
function billingDisabled() {
  return NextResponse.json(
    {
      error: "BILLING_DISABLED",
      message: "A contratação online está temporariamente desativada. Entre em contato com nossa equipe comercial.",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST() {
  return billingDisabled();
}

export async function GET() {
  return billingDisabled();
}
