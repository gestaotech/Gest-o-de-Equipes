import { timingSafeEqual } from "crypto";
import type { SubscriptionStatus } from "@prisma/client";

export interface AsaasWebhookPayment {
  id?: unknown;
  event?: unknown;
  payment?: {
    id?: unknown;
    subscription?: unknown;
  };
}

export const ASAAS_PAYMENT_EVENT_STATUS: Record<string, SubscriptionStatus> = {
  PAYMENT_CONFIRMED: "ACTIVE",
  PAYMENT_RECEIVED: "ACTIVE",
  PAYMENT_OVERDUE: "PAST_DUE",
  PAYMENT_REFUNDED: "REFUNDED",
};

export function isValidAsaasWebhookToken(received: string, expected: string): boolean {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
