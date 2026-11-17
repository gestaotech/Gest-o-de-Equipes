"use server";

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
