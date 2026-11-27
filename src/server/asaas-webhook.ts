import "server-only";
import { prisma } from "@/lib/prisma";
import {
  ASAAS_EVENT_STATUS,
  getAsaasCheckoutId,
  getAsaasExternalReference,
  getAsaasSubscriptionId,
  parseTeamFlowReference,
  type AsaasWebhookBody,
} from "@/lib/server/asaas/webhooks";

function periodEnd(tier: string) {
  const end = new Date();
  end.setDate(end.getDate() + (tier === "ANUAL" ? 365 : 30));
  return end;
}

async function activatePaidCheckout(reference: string, eventType: string) {
  const parsed = parseTeamFlowReference(reference);
  if (!parsed) return;

  const [organization, plan] = await Promise.all([
    prisma.organization.findUnique({ where: { id: parsed.organizationId } }),
    prisma.plan.findUnique({ where: { id: parsed.planId } }),
  ]);
  if (!organization || !plan || !["MENSAL", "ANUAL"].includes(plan.tier)) return;

  const now = new Date();
  const amount = plan.tier === "ANUAL" ? plan.priceYearly : plan.priceMonthly;
  const subscription = await prisma.subscription.upsert({
    where: { organizationId: organization.id },
    update: {
      planId: plan.id,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd(plan.tier),
      cancelAtPeriodEnd: false,
      trialDays: 0,
      trialEndsAt: null,
      provider: "ASAAS",
    },
    create: {
      organizationId: organization.id,
      planId: plan.id,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd(plan.tier),
      cancelAtPeriodEnd: false,
      trialDays: 0,
      provider: "ASAAS",
    },
  });

  await prisma.invoice.upsert({
    where: { subscriptionId: subscription.id },
    update: { amount, currency: "BRL", status: "PAGO", paidAt: now },
    create: { subscriptionId: subscription.id, amount, currency: "BRL", status: "PAGO", paidAt: now },
  });

  await prisma.activityLog.create({
    data: {
      organizationId: organization.id,
      action: "SUBSCRIPTION_ACTIVATED",
      entity: "subscription",
      entityId: subscription.id,
      newData: { asaasEvent: eventType, planTier: plan.tier },
    },
  });
}

async function registerCreatedAsaasSubscription(body: AsaasWebhookBody) {
  const reference = getAsaasExternalReference(body);
  const asaasSubscriptionId = getAsaasSubscriptionId(body);
  const parsed = reference ? parseTeamFlowReference(reference) : null;
  if (!parsed || !asaasSubscriptionId) return;

  const plan = await prisma.plan.findUnique({ where: { id: parsed.planId } });
  const organization = await prisma.organization.findUnique({ where: { id: parsed.organizationId } });
  if (!plan || !organization) return;

  await prisma.subscription.upsert({
    where: { organizationId: organization.id },
    update: { provider: "ASAAS", providerSubscriptionId: asaasSubscriptionId },
    create: {
      organizationId: organization.id,
      planId: plan.id,
      status: "PAST_DUE",
      provider: "ASAAS",
      providerSubscriptionId: asaasSubscriptionId,
    },
  });
}

export async function applyAsaasWebhookEvent(body: AsaasWebhookBody): Promise<void> {
  const eventType = typeof body.event === "string" ? body.event : "";

  // Checkout pago é a confirmação financeira da contratação. A URL de retorno
  // do navegador nunca ativa uma assinatura.
  if (eventType === "CHECKOUT_PAID") {
    const checkoutId = getAsaasCheckoutId(body);
    if (!checkoutId) return;
    const checkoutRecord = await prisma.webhookEvent.findUnique({
      where: { id: `checkout:${checkoutId}` },
    });
    const pending = checkoutRecord?.eventType.match(/^CHECKOUT_PENDING:([^:]+):([^:]+)$/);
    if (pending) {
      const reference = `TEAMFLOW:ORG:${pending[1]}:PLAN:${pending[2]}`;
      await activatePaidCheckout(reference, eventType);
      await prisma.webhookEvent.update({
        where: { id: `checkout:${checkoutId}` },
        data: { eventType: "CHECKOUT_PAID" },
      });
    }
    return;
  }

  if (eventType === "CHECKOUT_CANCELED" || eventType === "CHECKOUT_EXPIRED") {
    const checkoutId = getAsaasCheckoutId(body);
    if (checkoutId) {
      await prisma.webhookEvent.updateMany({
        where: { id: `checkout:${checkoutId}`, eventType: { startsWith: "CHECKOUT_PENDING:" } },
        data: { eventType },
      });
    }
    return;
  }

  if (eventType === "SUBSCRIPTION_CREATED") {
    await registerCreatedAsaasSubscription(body);
    return;
  }

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

  if (status === "ACTIVE") {
    await prisma.invoice.updateMany({
      where: { subscriptionId: subscription.id, status: "PENDENTE" },
      data: { status: "PAGO", paidAt: new Date() },
    });
  }

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
