import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash, timingSafeEqual } from "crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const { provider } = params;

  // Lê o corpo bruto para verificação de assinatura (quando aplicável)
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature") ?? "";
  const secret = process.env[`WEBHOOK_SECRET_${provider.toUpperCase()}`];

  // Verificação de assinatura quando secret configurado
  if (secret && signature) {
    const expected = createHash("sha256").update(rawBody).update(secret).digest("hex");
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "Payload JSON inválido." }, { status: 400 });
  }

  try {
    // Registra o webhook recebido para auditoria
    await prisma.activityLog.create({
      data: {
        organizationId: "system", // placeholder; pode ser preenchido pelo provedor específico
        action: `webhook.${provider}.received`,
        entity: "webhook",
        entityId: provider,
        newData: { provider, payload: JSON.stringify(payload).slice(0, 2000) },
      },
    });

    // Aqui você adicionaria o processamento específico por provedor
    // Exemplo: if (provider === "stripe") await processStripeWebhook(payload);

    return NextResponse.json({ received: true, provider });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro ao processar webhook." },
      { status: 500 }
    );
  }
}
