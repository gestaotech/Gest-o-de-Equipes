import "server-only";
import { prisma } from "@/lib/prisma";
import {
  ASAAS_EVENT_STATUS,
  getAsaasSubscriptionId,
  type AsaasWebhookBody,
} from "@/lib/server/asaas/webhooks";

// Eventos de assinatura (SUBSCRIPTION_*) não são mapeados aqui porque o nome exato
// e o payload variam; a confirmação de pagamento continua sendo a fonte de verdade
// para ativar/inadimplir. Eventos desconhecidos são registrados como recebidos e
// ignorados com segurança.
// Limitação conhecida: Invoice.subscriptionId é único no schema, então o modelo não
// comporta múltiplas faturas por assinatura sem migration.
export async function applyAsaasWebhookEvent(body: AsaasWebhookBody): Promise<void> {
  const eventType = typeof body.event === "string" ? body.event : "";
  const status = ASAAS_EVENT_STATUS[eventType];
  const asaasSubscriptionId = getAsaasSubscriptionId(body);

  if (!status || !asaasSubscriptionId) return;

  const subscription = await prisma.subscription.findFirst({
    where: { providerSubscriptionId: asaasSubscriptionId },
  });
  if (!subscription || subscription.status === "CANCELED") return;

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status },
  });

  await prisma.activityLog.create({
    data: {
      organizationId: subscription.organizationId,
      action: "BILLING_WEBHOOK_RECEIVED",
      entity: "subscription",
      entityId: subscription.id,
      newData: { asaasEvent: eventType, teamflowStatus: status },
    },
  });
}
