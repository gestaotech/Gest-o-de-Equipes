import "server-only";
import { prisma } from "@/lib/prisma";
import {
  ASAAS_PAYMENT_EVENT_STATUS,
  type AsaasWebhookPayment,
} from "@/lib/server/asaas/webhooks";

export async function applyAsaasPaymentEvent(body: AsaasWebhookPayment): Promise<void> {
  const eventType = typeof body.event === "string" ? body.event : "";
  const status = ASAAS_PAYMENT_EVENT_STATUS[eventType];
  const asaasSubscriptionId = body.payment?.subscription;

  if (!status || typeof asaasSubscriptionId !== "string") return;

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
