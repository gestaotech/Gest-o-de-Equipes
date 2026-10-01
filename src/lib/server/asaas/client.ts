"use server";

import "server-only";

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || "sandbox";
const ASAAS_BASE_URL =
  ASAAS_ENVIRONMENT === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";

if (!ASAAS_API_KEY) {
  throw new Error("ASAAS_API_KEY environment variable is not defined");
}

const api = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${ASAAS_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${ASAAS_API_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Asaas API error: ${response.status}`
    );
  }

  return response.json();
};

export { api };

/**
 * Request types for Asaas API
 */

export interface AsaasCreateCustomerInput {
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
  mobilePhone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  postalCode?: string;
}

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
  mobilePhone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  postalCode?: string;
  createdAt: string;
}

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

export interface AsaasSubscription {
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

export interface AsaasWebhookEvent {
  id: string;
  object: string;
  webhookStatus: string;
  resource: string;
  resourceId: string;
  event: string;
  eventDate: string;
  payload: string;
  signature?: string;
}

export interface AsaasPayment {
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

export interface AsaasCheckoutResult {
  id: string;
  paymentUrl: string;
  expiresAt: string;
  externalReference?: string;
}