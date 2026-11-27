"use server";

<<<<<<< HEAD
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
=======
import "server-only";
import { getSession, getActiveOrg } from "@/lib/auth";
import { handleAction, AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { api } from "@/lib/server/asaas/client";
import type { PlanTier } from "@prisma/client";

const VALID_TIERS: PlanTier[] = ["MENSAL", "ANUAL"];

function appUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const vercel = process.env.VERCEL_URL?.trim();
  const base = configured || (vercel ? `https://${vercel}` : "");
  if (!base || !/^https:\/\//.test(base)) {
    throw new AppError("CONFIGURATION", "Configure NEXT_PUBLIC_APP_URL com a URL HTTPS da aplicação.", 503);
  }
  return base.replace(/\/$/, "");
}

export async function startPlanCheckout(input: { tier: string }) {
  return handleAction(async () => {
    if (process.env.ASAAS_ENABLED !== "true") {
      throw new AppError(
        "BILLING_DISABLED",
        "A contratação online está temporariamente desativada. Entre em contato com nossa equipe comercial pelo WhatsApp.",
        503
      );
    }

    const session = await getSession();
    if (!session) throw new AppError("UNAUTHORIZED", "Entre na sua conta para continuar.", 401);

    const organization = await getActiveOrg(session);
    if (!organization) throw new AppError("ORG_REQUIRED", "Cadastre sua empresa antes de contratar.", 400);
    if (!["OWNER", "ADMIN"].includes(organization.role)) {
      throw new AppError("FORBIDDEN", "Somente o proprietário ou administrador pode contratar um plano.", 403);
    }

    const tier = input?.tier as PlanTier;
    if (!VALID_TIERS.includes(tier)) {
      throw new AppError("INVALID_PLAN", "Plano inválido para contratação online.", 400);
    }

    const [plan, user] = await Promise.all([
      prisma.plan.findUnique({ where: { tier } }),
      prisma.user.findUnique({ where: { id: session.sub }, select: { name: true, email: true } }),
    ]);
    if (!plan || !user) throw new AppError("NOT_FOUND", "Plano ou usuário não encontrado.", 404);

    const value = tier === "MENSAL" ? plan.priceMonthly : plan.priceYearly;
    if (!Number.isFinite(value) || value <= 0) {
      throw new AppError("INVALID_PLAN", "Este plano não possui preço para contratação online.", 400);
    }

    const baseUrl = appUrl();
    const cycle = tier === "ANUAL" ? "YEARLY" : "MONTHLY";
    const nextDueDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const externalReference = `TEAMFLOW:ORG:${organization.id}:PLAN:${plan.id}`;

    const checkout = await api("/checkouts", {
      method: "POST",
      body: JSON.stringify({
        billingTypes: ["CREDIT_CARD"],
        chargeTypes: ["RECURRENT"],
        minutesToExpire: 60,
        externalReference,
        customerData: { name: user.name, email: user.email },
        callback: {
          successUrl: `${baseUrl}/contratar/retorno?status=success`,
          cancelUrl: `${baseUrl}/contratar/retorno?status=canceled`,
          expiredUrl: `${baseUrl}/contratar/retorno?status=expired`,
        },
        items: [{
          name: `TeamFlow - Plano ${plan.name}`,
          description: `Assinatura ${cycle === "MONTHLY" ? "mensal" : "anual"} do TeamFlow`,
          quantity: 1,
          value,
        }],
        subscription: { cycle, nextDueDate },
      }),
    }) as { id?: string };

    if (!checkout?.id) {
      throw new AppError("CHECKOUT_FAILED", "O Asaas não retornou o identificador do checkout.", 502);
    }

    await prisma.webhookEvent.upsert({
      where: { id: `checkout:${checkout.id}` },
      update: { provider: "ASAAS", eventType: `CHECKOUT_PENDING:${organization.id}:${plan.id}` },
      create: {
        id: `checkout:${checkout.id}`,
        provider: "ASAAS",
        eventType: `CHECKOUT_PENDING:${organization.id}:${plan.id}`,
      },
    });

    const checkoutHost = process.env.ASAAS_ENVIRONMENT === "production"
      ? "https://asaas.com"
      : "https://sandbox.asaas.com";
    return {
      checkoutUrl: `${checkoutHost}/checkoutSession/show?id=${encodeURIComponent(checkout.id)}`,
    };
  });
}
>>>>>>> 5da453bd8add7d1a97c12b78146089988231f7ee
