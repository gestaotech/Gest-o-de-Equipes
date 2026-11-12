import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isValidAsaasWebhookToken,
  type AsaasWebhookBody,
} from "@/lib/server/asaas/webhooks";
import { applyAsaasWebhookEvent } from "@/server/asaas-webhook";

export async function POST(request: Request) {
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN ?? "";
  if (!expectedToken) {
    console.error("[webhook:asaas] ASAAS_WEBHOOK_TOKEN não configurado");
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });
  }

  const receivedToken = request.headers.get("asaas-access-token") ?? "";
  if (!isValidAsaasWebhookToken(receivedToken, expectedToken)) {
    return NextResponse.json({ error: "Token inválido." }, { status: 401 });
  }

  let body: AsaasWebhookBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload JSON inválido." }, { status: 400 });
  }

  const eventId = typeof body.id === "string" ? body.id : null;
  const eventType = typeof body.event === "string" ? body.event : null;
  if (!eventId || !eventType) {
    return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  }

  try {
    await prisma.webhookEvent.create({
      data: { id: eventId, provider: "ASAAS", eventType },
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[webhook:asaas] falha ao registrar evento", eventType);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }

  try {
    await applyAsaasWebhookEvent(body);
    return NextResponse.json({ received: true });
  } catch {
    await prisma.webhookEvent.delete({ where: { id: eventId } }).catch(() => undefined);
    console.error("[webhook:asaas] falha ao processar evento", eventType);
    return NextResponse.json({ error: "Erro ao processar evento." }, { status: 500 });
  }
}
