import { api } from "./client";

export interface AsaasPaymentResult {
  id: string;
  transactionId?: string;
  date: string;
  amount: number;
  value: number;
  fee?: number;
  netAmount?: number;
  discount?: number;
  fine?: number;
  interest?: number;
  penalty?: number;
  status: string;
  paymentMethod?: string;
  cardLastDigits?: string;
  cardBrand?: string;
  externalReference?: string;
  cancelReason?: string;
  cancelDate?: string;
}

export interface AsaasCreatePaymentInput {
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
}

export async function createPayment(
  data: AsaasCreatePaymentInput
): Promise<AsaasPaymentResult> {
  const result = await api("/payments", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return result;
}

export async function getPayment(id: string): Promise<AsaasPaymentResult> {
  const result = await api(`/payments/${id}`);
  return result;
}

export async function listPayments(
  customerId?: string,
  status?: string
): Promise<{ data: AsaasPaymentResult[]; total: number }> {
  const result = await api("/payments", {
    method: "GET",
  });
  return result;
}