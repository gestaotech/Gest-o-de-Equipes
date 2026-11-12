import { describe, it, expect } from "vitest";
import { ASAAS_PAYMENT_EVENT_STATUS, isValidAsaasWebhookToken } from "./webhooks";

const TOKEN = "token-de-teste-com-mais-de-32-caracteres-123";

describe("isValidAsaasWebhookToken", () => {
  it("aceita token idêntico ao configurado", () => {
    expect(isValidAsaasWebhookToken(TOKEN, TOKEN)).toBe(true);
  });

  it("rejeita token diferente de mesmo tamanho", () => {
    expect(isValidAsaasWebhookToken(TOKEN.replace(/.$/, "X"), TOKEN)).toBe(false);
  });

  it("rejeita token de tamanho diferente sem lançar erro", () => {
    expect(isValidAsaasWebhookToken("curto", TOKEN)).toBe(false);
  });

  it("rejeita quando o header não foi enviado", () => {
    expect(isValidAsaasWebhookToken("", TOKEN)).toBe(false);
  });

  it("rejeita quando o token configurado está vazio", () => {
    expect(isValidAsaasWebhookToken("", "")).toBe(false);
  });
});

describe("ASAAS_PAYMENT_EVENT_STATUS", () => {
  it("ativa a assinatura quando o pagamento é confirmado ou recebido", () => {
    expect(ASAAS_PAYMENT_EVENT_STATUS.PAYMENT_CONFIRMED).toBe("ACTIVE");
    expect(ASAAS_PAYMENT_EVENT_STATUS.PAYMENT_RECEIVED).toBe("ACTIVE");
  });

  it("marca como inadimplente quando o pagamento vence", () => {
    expect(ASAAS_PAYMENT_EVENT_STATUS.PAYMENT_OVERDUE).toBe("PAST_DUE");
  });

  it("marca como reembolsada quando há estorno", () => {
    expect(ASAAS_PAYMENT_EVENT_STATUS.PAYMENT_REFUNDED).toBe("REFUNDED");
  });

  it("ignora eventos sem mudança de status", () => {
    expect(ASAAS_PAYMENT_EVENT_STATUS.PAYMENT_CREATED).toBeUndefined();
    expect(ASAAS_PAYMENT_EVENT_STATUS.PAYMENT_UPDATED).toBeUndefined();
  });
});
