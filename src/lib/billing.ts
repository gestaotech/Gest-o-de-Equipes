"use server";

import "server-only";

import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

import {
  api as asaasApi,
  AsaasCustomer,
  AsaasCreateSubscriptionInput,
  AsaasSubscription,
  AsaasCreatePaymentInput,
  AsaasPayment,
  AsaasWebhookEvent,
  AsaasCheckoutResult,
  AsaasCreateCheckoutInput,
} from "@/lib/server/asaas/client";

import type {
  Organization,
  Subscription,
  Plan,
  Invoice,
} from "@prisma/client";

// ============================================================
// Types and mappings
// ============================================================

type AsaasEventMapper =
  | "subscriptionCreated"
  | "subscriptionUpdated"
  | "subscriptionActivated"
  | "subscriptionDeactivated"
  | "subscriptionCanceled"
  | "paymentCreated"
  | "paymentUpdated"
  | "paymentReceived"
  | "paymentOverdue"
  | "paymentRefunded";

interface BillingEventMapping {
  asaasEvent?: AsaasEventMapper;
  teamflowStatus?: string;
}

const eventMapper: Record<AsaasEventMapper, BillingEventMapping> = {
  subscriptionCreated: { asaasEvent: "subscriptionCreated", teamflowStatus: "ACTIVE" },
  subscriptionUpdated: { asaasEvent: "subscriptionUpdated", teamflowStatus: "ACTIVE" },
  subscriptionActivated: { asaasEvent: "subscriptionActivated", teamflowStatus: "ACTIVE" },
  subscriptionDeactivated: { asaasEvent: "subscriptionDeactivated", teamflowStatus: "PAST_DUE" },
  subscriptionCanceled: { asaasEvent: "subscriptionCanceled", teamflowStatus: "CANCELED" },
  paymentCreated: { teamflowStatus: "PENDING" },
  paymentUpdated: { teamflowStatus: "PENDING" },
  paymentReceived: { asaasEvent: "paymentReceived", teamflowStatus: "ACTIVE" },
  paymentOverdue: { asaasEvent: "paymentOverdue", teamflowStatus: "PAST_DUE" },
  paymentRefunded: { teamflowStatus: "REFUNDED" },
};

// ============================================================
// Exported async functions
// ============================================================

export async function createCustomer(data: {
  organizationId: string;
  responsibleName: string;
  responsibleEmail: string;
  cpfCnpj?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  complement?: string | null;
  province?: string | null;
  postalCode?: string | null;
}): Promise<{ asaasCustomerId: string }> {
  const result = await asaasApi("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: data.responsibleName,
      email: data.responsibleEmail,
      cpfCnpj: data.cpfCnpj,
      phone: data.phone,
      mobilePhone: data.mobilePhone,
      address: data.address,
      addressNumber: data.addressNumber,
      complement: data.complement,
      province: data.province,
      postalCode: data.postalCode,
    }),
  });

  return { asaasCustomerId: result.id };
}

export async function getCustomer(asaasCustomerId: string): Promise<AsaasCustomer> {
  return await asaasApi(`/customers/${asaasCustomerId}`);
}

export async function createSubscription({
  organizationId,
  planId,
  cycle,
}: {
  organizationId: string;
  planId: string;
  cycle: "MONTHLY" | "YEARLY";
}): Promise<{
  asaasSubscriptionId: string;
  asaasCustomerId: string;
  subscription: Subscription;
}> {
  // Ensure we have a customer
  const customerData = await createCustomer({
    organizationId,
    responsibleName: "",
    responsibleEmail: "",
    cpfCnpj: null,
    phone: null,
    mobilePhone: null,
    address: null,
    addressNumber: null,
    complement: null,
    province: null,
    postalCode: null,
  });

  // Get plan details
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  // Value in centavos
  const valueInCents = Math.round(
    cycle === "MONTHLY" ? plan.priceMonthly * 100 : plan.priceYearly * 100
  );

  // Create subscription in Asaas
  const asaasData: AsaasCreateSubscriptionInput = {
    customer: customerData.asaasCustomerId,
    plan: uuidv4(),
    cycle,
    externalReference: `TEAMFLOW:ORG:${organizationId}:PLAN:${planId}`,
    billingType: "CARTAO",
    value: valueInCents,
  };

  const result = await asaasApi("/subscriptions", {
    method: "POST",
    body: JSON.stringify(asaasData),
  });

  // Create or update local subscription
  const subscription = await prisma.subscription.upsert({
    where: { organizationId },
    update: {
      planId,
      status: "ACTIVE" as const,
      currentPeriodStart: new Date(),
      currentPeriodEnd:
        cycle === "MONTHLY"
          ? new Date(Date.now() + 30 * 86400000)
          : new Date(Date.now() + 365 * 86400000),
      cancelAtPeriodEnd: false,
      provider: "ASAAS",
      providerCustomerId: customerData.asaasCustomerId,
      providerSubscriptionId: result.id,
    },
    create: {
      organizationId,
      planId,
      status: "ACTIVE" as const,
      currentPeriodStart: new Date(),
      currentPeriodEnd:
        cycle === "MONTHLY"
          ? new Date(Date.now() + 30 * 86400000)
          : new Date(Date.now() + 365 * 86400000),
      cancelAtPeriodEnd: false,
      provider: "ASAAS",
      providerCustomerId: customerData.asaasCustomerId,
      providerSubscriptionId: result.id,
    },
  });

  return {
    asaasSubscriptionId: result.id,
    asaasCustomerId: customerData.asaasCustomerId,
    subscription,
  };
}

export async function updateSubscription({
  subscriptionId,
  status,
  cycle,
}: {
  subscriptionId: string;
  status?: string;
  cycle?: "MONTHLY" | "YEARLY";
}): Promise<Subscription> {
  // Update in Asaas
  if (status || cycle) {
    await asaasApi(`/subscriptions/${subscriptionId}`, {
      method: "PUT",
      body: JSON.stringify({
        status,
        cycle,
      }),
    });
  }

  // Update local
  const updateData = {
    ...(status && { status }),
    ...(cycle && { cycle }),
  };

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: updateData,
  });

  return updated;
}

export async function createCheckout({
  organizationId,
  planId,
  cycle,
}: {
  organizationId: string;
  planId: string;
  cycle: "MONTHLY" | "YEARLY";
}): Promise<{ checkoutUrl: string; asaasCheckoutId: string }> {
  // Ensure organization has a customer
  const customerData = await createCustomer({
    organizationId,
    responsibleName: "",
    responsibleEmail: "",
    cpfCnpj: null,
    phone: null,
    mobilePhone: null,
    address: null,
    addressNumber: null,
    complement: null,
    province: null,
    postalCode: null,
  });

  // Get plan details
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  // Value in centavos
  const valueInCents = Math.round(
    cycle === "MONTHLY" ? plan.priceMonthly * 100 : plan.priceYearly * 100
  );

  // Create checkout in Asaas
  const checkoutData: AsaasCreateCheckoutInput = {
    customer: customerData.asaasCustomerId,
    value: valueInCents,
    description: `TeamFlow - ${plan.name} (${cycle})`,
    externalReference: `TEAMFLOW:ORG:${organizationId}:PLAN:${planId}`,
    billingType: "CARTAO",
  };

  const result = await asaasApi("/checkouts", {
    method: "POST",
    body: JSON.stringify(checkoutData),
  });

  return {
    checkoutUrl: result.paymentUrl,
    asaasCheckoutId: result.id,
  };
}

export async function handleWebhook(
  event: AsaasWebhookEvent,
  webhookToken: string
): Promise<void> {
  // Verify webhook signature
  const crypto = require("crypto");
  const hmac = crypto.createHmac("sha256", webhookToken);
  hmac.update(event.payload);
  const computedSignature = hmac.digest("hex");

  const isValid = computedSignature === (event.signature || "");

  if (!isValid) {
    throw new Error("Invalid webhook signature");
  }

  // Parse the event payload
  const parsedEvent = JSON.parse(event.payload);
  const asaasEvent = parsedEvent.event as AsaasEventMapper;

  // Map to teamflow event
  const mapping = eventMapper[asaasEvent];
  if (!mapping) {
    // Unknown event, log but don't crash
    await prisma.activityLog.create({
      data: {
        organizationId: "",
        action: "BILLING_WEBHOOK_RECEIVED",
        entity: "subscription",
        entityId: parsedEvent.resourceId,
        newData: JSON.stringify({
          asaasEvent,
          webhookId: event.id,
        }),
      },
    });
    return;
  }

  const subscriptionId = parsedEvent.resourceId;

  // Find the subscription
  const subscription = await prisma.subscription.findFirst({
    where: { providerSubscriptionId: subscriptionId },
    include: { organization: true, plan: true },
  });

  if (!subscription) {
    return;
  }

  const org = subscription.organization;

  // Update subscription status based on event
  const statusValue = mapping.teamflowStatus || subscription.status;

  // Handle specific events
  switch (asaasEvent) {
    case "subscriptionCreated":
    case "subscriptionUpdated":
    case "subscriptionActivated":
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "ACTIVE" },
      });
      break;

    case "subscriptionDeactivated":
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "PAST_DUE" },
      });
      break;

    case "subscriptionCanceled":
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "CANCELED" },
      });
      break;

    case "paymentReceived":
      // Create or update invoice
      await prisma.invoice.upsert({
        where: {
          subscriptionId: subscription.id,
        },
        create: {
          subscriptionId: subscription.id,
          amount: parsedEvent.resource?.amount || 0,
          currency: "BRL",
          status: "RECEBIDO",
          dueAt: null,
          paidAt: new Date(),
        },
        update: {
          status: "RECEBIDO",
          paidAt: new Date(),
        },
      });
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "ACTIVE" },
      });
      break;

    case "paymentOverdue":
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "PAST_DUE" },
      });
      break;

    case "paymentRefunded":
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "REFUNDED" },
      });
      break;
  }

  // Log the event
  await prisma.activityLog.create({
    data: {
      organizationId: org.id,
      action: "BILLING_WEBHOOK_RECEIVED",
      entity: "subscription",
      entityId: subscription.id,
      newData: JSON.stringify({
        asaasEvent,
        teamflowStatus: statusValue,
      }),
    },
  });
}

export async function processWebhook(
  payload: string,
  signature: string
): Promise<void> {
  const event = JSON.parse(payload);
  // Find provider by resourceId and handle webhook
  const resourceId = (event as { resourceId?: string }).resourceId;
  if (resourceId) {
    const organization = await prisma.organization.findUnique({
      where: { id: resourceId },
      include: { subscriptions: true },
    });
    if (!organization) {
      return;
    }
    // Handle webhook using the organization's provider
    // ... webhook handling logic
  }
}

// ============================================================
// Billing Service API
// ============================================================

export async function getBillingProvider(
  organizationId: string
): Promise<{
  createCustomer: typeof createCustomer;
  createSubscription: typeof createSubscription;
  createCheckout: typeof createCheckout;
  handleWebhook: typeof handleWebhook;
}> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { subscriptions: true },
  });

  if (!organization) {
    throw new Error(`Organization ${organizationId} not found`);
  }

  return {
    createCustomer,
    createSubscription,
    createCheckout,
    handleWebhook,
  };
}