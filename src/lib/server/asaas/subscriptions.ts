import { api } from "./client";

export interface AsaasCreateSubscriptionInput {
  customer: string;
  plan: string;
  cycle: "MONTHLY" | "YEARLY";
  externalReference?: string;
  billingType?: "PIX" | "BOLETO" | "CARTAO";
  installmentQuantity?: number;
  value?: number;
  paymentMethod?: string;
  card?: {
    hash: string;
    brand?: string;
    lastDigits?: string;
    expirationMonth?: string;
    expirationYear?: string;
    securityCode?: string;
  };
}

export interface AsaasSubscriptionResult {
  id: string;
  customer: string;
  plan: string;
  cycle: string;
  status: string;
  value: number;
  valueBilling?: number;
  billingType?: string;
  expirationDate?: string;
  nextPaymentDate?: string;
  createdAt: string;
  updatedAt: string;
  externalReference?: string;
}

export interface AsaasUpdateSubscriptionInput {
  status?: string;
  cycle?: "MONTHLY" | "YEARLY";
  externalReference?: string;
  billingType?: "PIX" | "BOLETO" | "CARTAO";
  value?: number;
}

export async function createSubscription(
  data: AsaasCreateSubscriptionInput
): Promise<AsaasSubscriptionResult> {
  const result = await api("/subscriptions", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return result;
}

export async function getSubscription(id: string): Promise<AsaasSubscriptionResult> {
  const result = await api(`/subscriptions/${id}`);
  return result;
}

export async function updateSubscription(
  id: string,
  data: AsaasUpdateSubscriptionInput
): Promise<AsaasSubscriptionResult> {
  const result = await api(`/subscriptions/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return result;
}

export async function deleteSubscription(id: string): Promise<unknown> {
  const result = await api(`/subscriptions/${id}`, {
    method: "DELETE",
  });
  return result;
}