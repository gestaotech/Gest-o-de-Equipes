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

  // Determine trial days based on plan tier
  // PlanTier order: MENSAL=0, ANUAL=1, ECOSISTEMA=2
  const trialDaysMap: Record<string, number> = {
    MENSAL: 7, // 7-day trial for MENSAL plan
    ANUAL: 15, // 15-day trial for ANUAL plan
    ECOSISTEMA: 30, // 30-day trial for ECOSISTEMA plan
  };

  const trialDays = trialDaysMap[plan.tier] || 0;

  // Value in centavos
  const valueInCents = Math.round(
    cycle === "MONTHLY" ? plan.priceMonthly * 100 : plan.priceYearly * 100
  );

  // Calculate trial end date
  const trialEndsAt = trialDays > 0
    ? new Date(Date.now() + trialDays * 86400000)
    : undefined;

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
      status: trialDays > 0 ? "TRIALING" : "ACTIVE" as const,
      currentPeriodStart: new Date(),
      currentPeriodEnd:
        cycle === "MONTHLY"
          ? new Date(Date.now() + 30 * 86400000)
          : new Date(Date.now() + 365 * 86400000),
      cancelAtPeriodEnd: false,
      trialDays,
      trialEndsAt,
      provider: "ASAAS",
      providerCustomerId: customerData.asaasCustomerId,
      providerSubscriptionId: result.id,
    },
    create: {
      organizationId,
      planId,
      status: trialDays > 0 ? "TRIALING" : "ACTIVE" as const,
      currentPeriodStart: new Date(),
      currentPeriodEnd:
        cycle === "MONTHLY"
          ? new Date(Date.now() + 30 * 86400000)
          : new Date(Date.now() + 365 * 86400000),
      cancelAtPeriodEnd: false,
      trialDays,
      trialEndsAt,
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
  status?: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "REFUNDED";
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
  const updateData: {
    status?: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "REFUNDED";
    cycle?: "MONTHLY" | "YEARLY";
  } = {};
  if (status) updateData.status = status;
  if (cycle) updateData.cycle = cycle;

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

// ============================================================
// Billing Service API
// ============================================================

export async function getBillingProvider(
  organizationId: string
): Promise<{
  createCustomer: typeof createCustomer;
  createSubscription: typeof createSubscription;
  createCheckout: typeof createCheckout;
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
  };
}