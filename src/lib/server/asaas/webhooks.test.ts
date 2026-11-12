import { describe, it, expect } from "vitest";
import { ASAAS_EVENT_STATUS, getAsaasSubscriptionId, isValidAsaasWebhookToken } from "./webhooks";

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

describe("ASAAS_EVENT_STATUS", () => {
  it("ativa a assinatura quando o pagamento é confirmado ou recebido", () => {
    expect(ASAAS_EVENT_STATUS.PAYMENT_CONFIRMED).toBe("ACTIVE");
    expect(ASAAS_EVENT_STATUS.PAYMENT_RECEIVED).toBe("ACTIVE");
  });

  it("marca como inadimplente quando o pagamento vence", () => {
    expect(ASAAS_EVENT_STATUS.PAYMENT_OVERDUE).toBe("PAST_DUE");
  });

  it("marca como reembolsada quando há estorno", () => {
    expect(ASAAS_EVENT_STATUS.PAYMENT_REFUNDED).toBe("REFUNDED");
  });

  it("ignora eventos sem mudança de status", () => {
    expect(ASAAS_EVENT_STATUS.PAYMENT_CREATED).toBeUndefined();
    expect(ASAAS_EVENT_STATUS.PAYMENT_UPDATED).toBeUndefined();
    expect(ASAAS_EVENT_STATUS.SUBSCRIPTION_CREATED).toBeUndefined();
  });
});

describe("getAsaasSubscriptionId", () => {
  it("lê o id de assinatura do pagamento", () => {
    expect(getAsaasSubscriptionId({ payment: { subscription: "sub_123" } })).toBe("sub_123");
  });

  it("lê o id quando a assinatura vem como string", () => {
    expect(getAsaasSubscriptionId({ subscription: "sub_456" })).toBe("sub_456");
  });

  it("lê o id quando a assinatura vem como objeto", () => {
    expect(getAsaasSubscriptionId({ subscription: { id: "sub_789" } })).toBe("sub_789");
  });

  it("retorna null quando não há assinatura", () => {
    expect(getAsaasSubscriptionId({ event: "PAYMENT_RECEIVED" })).toBeNull();
  });
});
