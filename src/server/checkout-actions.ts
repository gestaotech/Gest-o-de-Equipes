"use server";

import { prisma } from "@/lib/prisma";
import { handleAction, AppError, ok } from "@/lib/errors";
import { requireSessionApi } from "@/lib/auth";
import { requireDataScope } from "@/server/scope";
import { guardPerm } from "@/server/guards";
import { logActivity } from "@/server/activity";
import { v4 as uuidv4 } from "uuid";
import {
  api as asaasApi,
  AsaasCustomer,
  AsaasCreateCheckoutInput,
  AsaasCheckoutResult,
} from "@/lib/server/asaas/client";

export async function createCheckoutSession(input: { planId: string; cycle: "MONTHLY" | "YEARLY" }) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    guardPerm(scope.membership, "settings.write");

    const { planId, cycle } = input;

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new AppError("NOT_FOUND", "Plano não encontrado.", 404);

    // Buscar ou criar customer Asaas para a organização
    const orgCustomer = await prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: { asaasCustomerId: true, name: true },
    });

    let asaasCustomerId = orgCustomer?.asaasCustomerId;
    if (!asaasCustomerId) {
      const customerData = {
        name: orgCustomer?.name || "Cliente TeamFlow",
        email: session.email,
      };
      const result = await asaasApi("/customers", {
        method: "POST",
        body: JSON.stringify(customerData),
      });
      asaasCustomerId = result.id;
      await prisma.organization.update({
        where: { id: scope.orgId },
        data: { asaasCustomerId },
      });
    }

    const valueInCents = Math.round(
      cycle === "MONTHLY" ? plan.priceMonthly * 100 : plan.priceYearly * 100
    );

    const checkoutData = {
      customer: asaasCustomerId,
      value: valueInCents,
      description: `TeamFlow - ${plan.name} (${cycle === "MONTHLY" ? "Mensal" : "Anual"})`,
      externalReference: `TEAMFLOW:ORG:${scope.orgId}:PLAN:${planId}`,
      billingType: "CARTAO" as const,
    };

    const result: AsaasCheckoutResult = await asaasApi("/checkouts", {
      method: "POST",
      body: JSON.stringify(checkoutData),
    });

    await logActivity({
      action: "BILLING_CHECKOUT_CREATED",
      entity: "subscription",
      entityId: scope.orgId,
      newData: { planId, cycle, asaasCheckoutId: result.id, asaasCustomerId },
    });

    return ok({ checkoutUrl: result.paymentUrl, asaasCheckoutId: result.id });
  });
}

export async function getSubscriptionStatus() {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: scope.orgId },
      include: { plan: true },
    });

    return ok({ subscription });
  });
}

export async function cancelSubscription() {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    guardPerm(scope.membership, "settings.write");

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: scope.orgId },
    });
    if (!subscription || !subscription.providerSubscriptionId) {
      throw new AppError("NOT_FOUND", "Nenhuma assinatura ativa encontrada.", 404);
    }

    // Cancelar na Asaas
    await asaasApi(`/subscriptions/${subscription.providerSubscriptionId}`, {
      method: "DELETE",
    });

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "CANCELED", cancelAtPeriodEnd: true },
    });

    await logActivity({
      action: "BILLING_SUBSCRIPTION_CANCELED",
      entity: "subscription",
      entityId: subscription.id,
      newData: { providerSubscriptionId: subscription.providerSubscriptionId },
    });

    return ok({});
  });
}