import { api } from "./client";

export interface AsaasCheckoutResult {
  id: string;
  paymentUrl: string;
  expiresAt: string;
  externalReference?: string;
}

export interface AsaasCreateCheckoutInput {
  customer: string;
  calendar?: string;
  value: number;
  description?: string;
  externalReference?: string;
  paymentMethod?: string;
  card?: {
    hash: string;
    brand?: string;
    lastDigits?: string;
    expirationMonth?: string;
    expirationYear?: string;
    securityCode?: string;
  };
  billingType?: "PIX" | "BOLETO" | "CARTAO";
}

export async function createCheckout(
  data: AsaasCreateCheckoutInput
): Promise<AsaasCheckoutResult> {
  const result = await api("/checkouts", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return result;
}