import type { PlanTier } from "@prisma/client";

export const PLANS: {
  tier: PlanTier;
  name: string;
  maxUsers: number | null;
  maxTeams: number | null;
  maxProjects: number | null;
  advancedReports: boolean;
  integrations: boolean;
  aiFeatures: boolean;
  priceMonthly: number;
  priceYearly: number;
  contact?: string;
  note?: string;
}[] = [
  {
    tier: "MENSAL",
    name: "Mensal",
    maxUsers: 20,
    maxTeams: 5,
    maxProjects: 20,
    advancedReports: false,
    integrations: false,
    aiFeatures: false,
    priceMonthly: 150.0,
    priceYearly: 0,
  },
  {
    tier: "ANUAL",
    name: "Anual",
    maxUsers: 100,
    maxTeams: 20,
    maxProjects: null,
    advancedReports: true,
    integrations: true,
    aiFeatures: false,
    priceMonthly: 0,
    priceYearly: 1500.0,
  },
  {
    tier: "ECOSISTEMA",
    name: "Integração com Ecossistema",
    maxUsers: null,
    maxTeams: null,
    maxProjects: null,
    advancedReports: true,
    integrations: true,
    aiFeatures: true,
    priceMonthly: 0,
    priceYearly: 0,
    contact: "whatsapp:61 9 98361296",
    note: "Sob consulta — entre em contato pelo WhatsApp (61) 9 98361296",
  },
];

export function getPlanByTier(tier: PlanTier) {
  return PLANS.find((p) => p.tier === tier);
}

export function formatPrice(plan: { priceMonthly: number; priceYearly: number }) {
  if (plan.priceMonthly > 0) {
    return {
      price: `R$ ${plan.priceMonthly.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      period: "/mês por empresa",
    };
  }
  if (plan.priceYearly > 0) {
    return {
      price: `R$ ${plan.priceYearly.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      period: "/ano por empresa",
    };
  }
  return {
    price: "Sob consulta",
    period: "",
  };
}
