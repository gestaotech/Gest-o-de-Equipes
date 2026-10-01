import { api } from "./client";
import crypto from "crypto";

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

export interface AsaasWebhookVerification {
  valid: boolean;
  error?: string;
}

export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  webhookToken: string
): Promise<AsaasWebhookVerification> {
  const hmac = crypto.createHmac("sha256", webhookToken);
  hmac.update(payload);
  const computedSignature = hmac.digest("hex");

  const isValid = computedSignature === signature;

  return {
    valid: isValid,
    error: isValid ? undefined : "Invalid webhook signature",
  };
}

export async function parseWebhookEvent(
  payload: string
): Promise<AsaasWebhookEvent> {
  const result = JSON.parse(payload);
  return result;
}