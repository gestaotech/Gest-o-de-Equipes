/**
 * Sanitização centralizada de dados para logs de auditoria.
 *
 * Requisitos LGPD:
 * - Nunca armazenar senhas, hashes de senha, CPF em texto puro, segredos TOTP,
 *   códigos de recuperação, tokens de autenticação, chaves de API, segredos de
 *   integrações, dados financeiros ou pessoais desnecessários.
 * - Sanitização recursiva de objetos e arrays.
 * - Campos sensíveis são substituídos por "[REDACTED]".
 * - Campos de dados pessoais podem ser mascarados (ex: e-mail → j***@empresa.com).
 */

import { maskCpf, maskPhone, maskEmail } from "@/lib/encryption";

/**
 * Chaves que devem ser completamente removidas/redigidas dos logs.
 * Nunca armazenamos esses valores, mesmo em hash.
 */
const REDACT_KEYS = new Set([
  "password",
  "passwordhash",
  "passwordhash",
  "token",
  "refreshtoken",
  "sessiontoken",
  "accesstoken",
  "apikey",
  "keyhash",
  "secret",
  "authorization",
  "cookie",
  "csrftoken",
  "resettoken",
  "accesstoken",
  "refreshtoken",
  "sessionid",
  "sid",
  "totpsecret",
  "backupcodes",
  "creditcard",
  "numerocartao",
  "cvv",
]);

/**
 * Chaves que contêm dados pessoais e devem ser mascaradas (não removidas).
 * Mantém utilidade para auditoria sem expor o dado completo.
 */
const MASK_KEYS = new Set([
  "email",
  "emailaddress",
  "mail",
  "phone",
  "telefone",
  "celular",
  "cpf",
  "document",
  "name",
  "nome",
  "fullname",
  "nomecompleto",
  "ip",
  "ipaddress",
  "ip_address",
]);

/**
 * Sanitiza dados recursivamente removendo ou mascarando campos sensíveis.
 */
export function sanitizeAuditData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditData(item));
  }

  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();

      // Campos que devem ser completamente redigidos (match exato ou contém "secret")
      const isRedactKey = REDACT_KEYS.has(lowerKey) || lowerKey.includes("secret");

      if (isRedactKey) {
        sanitized[key] = "[REDACTED]";
        continue;
      }

      // Campos de dados pessoais que devem ser mascarados
      if (MASK_KEYS.has(lowerKey) && typeof value === "string") {
        if (lowerKey === "email" || lowerKey === "emailaddress" || lowerKey === "mail") {
          sanitized[key] = maskEmail(value);
        } else if (
          lowerKey === "phone" ||
          lowerKey === "telefone" ||
          lowerKey === "celular"
        ) {
          sanitized[key] = maskPhone(value);
        } else if (lowerKey === "cpf" || lowerKey === "document") {
          sanitized[key] = maskCpf(value);
        } else if (
          lowerKey === "name" ||
          lowerKey === "nome" ||
          lowerKey === "fullname" ||
          lowerKey === "nomecompleto"
        ) {
          // Mostrar apenas a primeira letra do nome
          sanitized[key] = value.length > 0 ? `${value.charAt(0)}***` : value;
        } else if (lowerKey === "ip" || lowerKey === "ipaddress" || lowerKey === "ip_address") {
          // Mascarar último octeto do IP
          sanitized[key] = maskIp(value);
        } else {
          sanitized[key] = value;
        }
        continue;
      }

      // Recursão para objetos aninhados
      sanitized[key] = sanitizeAuditData(value);
    }

    return sanitized;
  }

  return data;
}

/**
 * Mascara endereço IP: remove o último octeto (IPv4) ou grupo (IPv6).
 * Ex: 192.168.1.100 → 192.168.1.x
 */
function maskIp(ip: string): string {
  if (!ip) return ip;
  // IPv4
  const ipv4Match = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.)\d{1,3}$/);
  if (ipv4Match) {
    return `${ipv4Match[1]}x`;
  }
  // IPv6 (simplificado)
  const ipv6Match = ip.match(/^([0-9a-f:]+:)[0-9a-fx]+$/i);
  if (ipv6Match) {
    return `${ipv6Match[1]}x`;
  }
  // IPv4-mapped IPv6
  const ipv4Mapped = ip.replace(/^::ffff:/, "");
  if (ipv4Mapped !== ip) {
    return `::ffff:${maskIp(ipv4Mapped)}`;
  }
  return ip;
}

/**
 * Verifica se um objeto contém dados sensíveis que não devem ser logados.
 * Útil para validação prévia antes de gravar no ActivityLog.
 */
export function containsSensitiveData(data: unknown): boolean {
  if (data === null || data === undefined) return false;
  if (typeof data !== "object") return false;

  if (Array.isArray(data)) {
    return data.some((item) => containsSensitiveData(item));
  }

  const obj = data as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    if (REDACT_KEYS.has(lowerKey)) {
      if (typeof value === "string" && value.length > 0) {
        return true;
      }
    }

    if (typeof value === "object" && value !== null) {
      if (containsSensitiveData(value)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Versão "safe" para logging: sanitiza e, se ainda contiver dados sensíveis
 * não reconhecidos, retorna um marcador genérico.
 */
export function safeAuditData(data: unknown): unknown {
  if (containsSensitiveData(data)) {
    // Ainda há campos sensíveis não mapeados; retorne marcador genérico
    return { [REDACT_KEYS.keys().next().value ?? "data"]: "[REDACTED]" };
  }
  return sanitizeAuditData(data);
}
