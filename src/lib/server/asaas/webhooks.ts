import { timingSafeEqual } from "crypto";
import type { SubscriptionStatus } from "@prisma/client";

export interface AsaasWebhookBody {
  id?: unknown;
  event?: unknown;
  payment?: {
    id?: unknown;
    subscription?: unknown;
  };
  subscription?: unknown;
}

export const ASAAS_EVENT_STATUS: Record<string, SubscriptionStatus> = {
  PAYMENT_CONFIRMED: "ACTIVE",
  PAYMENT_RECEIVED: "ACTIVE",
  PAYMENT_OVERDUE: "PAST_DUE",
  PAYMENT_REFUNDED: "REFUNDED",
};

export function getAsaasSubscriptionId(body: AsaasWebhookBody): string | null {
  const fromPayment = body.payment?.subscription;
  if (typeof fromPayment === "string" && fromPayment) return fromPayment;

  const sub = body.subscription;
  if (typeof sub === "string" && sub) return sub;
  if (sub && typeof sub === "object" && "id" in sub) {
    const id = (sub as { id?: unknown }).id;
    if (typeof id === "string" && id) return id;
  }

  return null;
}

export function isValidAsaasWebhookToken(received: string, expected: string): boolean {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
