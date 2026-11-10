import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Webhook genérico para recebimento de eventos de provedores externos.
 *
 * Segurança:
 * - HMAC-SHA256 para validação de assinatura (não SHA-256 simples)
 * - Comparação em tempo constante (timingSafeEqual)
 * - Rejeição quando assinatura está ausente e segredo está configurado
 * - Validação do corpo bruto da requisição
 * - Proteção contra replay via ID de evento único
 * - Limite de tamanho do payload
 * - Nenhum dado sensível é registrado em logs
 */

const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1 MB máximo

// Tokens de evento já processados (proteção contra replay simples)
// Em produção, isso deve ser persistente (Redis/banco)
const processedEventIds = new Set<string>();
const MAX_PROCESSED_EVENTS = 1000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  // Validar provedor
  const allowedProviders = ["asaas", "stripe", "github", "sendgrid"];
  if (!allowedProviders.includes(provider.toLowerCase())) {
    return NextResponse.json({ error: "Provedor não suportado." }, { status: 400 });
  }

  // Ler o corpo bruto para verificação de assinatura
  const rawBody = await request.text();

  // Limite de tamanho do payload
  if (rawBody.length > MAX_PAYLOAD_SIZE) {
    return NextResponse.json({ error: "Payload muito grande." }, { status: 413 });
  }

  const signature = request.headers.get("x-signature") ?? "";
  const secret = process.env[`WEBHOOK_SECRET_${provider.toUpperCase()}`];

  // Validação obrigatória de assinatura quando segredo está configurado
  if (secret) {
    if (!signature) {
      return NextResponse.json({ error: "Assinatura ausente." }, { status: 401 });
    }

    // HMAC-SHA256 sobre o corpo bruto com a chave secreta
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

    // Comparação em tempo constante
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
    }
  } else {
    // Sem segredo configurado: apenas log de aviso, não processar
    console.warn(`[webhook:${provider}] SECRET não configurado. Webhook rejeitado por segurança.`);
    return NextResponse.json({ error: "Provedor não configurado." }, { status: 503 });
  }

  let payload: unknown;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "Payload JSON inválido." }, { status: 400 });
  }

  // Extrair ID do evento para proteção contra replay
  const eventId =
    (payload as { id?: string })?.id ||
    (payload as { event?: { id?: string } })?.event?.id ||
    (payload as { resource?: { id?: string } })?.resource?.id;

  if (eventId) {
    // Proteção contra replay: rejeitar evento já processado
    if (processedEventIds.has(eventId)) {
      return NextResponse.json({ error: "Evento já processado." }, { status: 409 });
    }
    if (processedEventIds.size >= MAX_PROCESSED_EVENTS) {
      processedEventIds.clear(); // Limpar se exceder limite
    }
    processedEventIds.add(eventId);
  }

  try {
    // Registrar o webhook recebido para auditoria (SEM o payload completo)
    await prisma.activityLog.create({
      data: {
        organizationId: "system",
        action: `webhook.${provider}.received`,
        entity: "webhook",
        entityId: provider,
        newData: {
          provider,
          eventId,
          receivedAt: new Date().toISOString(),
          // NÃO registrar o payload completo - pode conter dados sensíveis
          payloadSize: rawBody.length,
        },
      },
    });

    // Processamento específico por provedor (implementar conforme necessário)
    // Exemplo: if (provider === "asaas") await processAsaasWebhook(payload);

    return NextResponse.json({ received: true, provider, eventId });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      { error: "Erro ao processar webhook." },
      { status: 500 }
    );
  }
}
