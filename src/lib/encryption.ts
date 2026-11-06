/**
 * Criptografia simétrica (AES-256-GCM) para dados pessoais sensíveis.
 *
 * Requisitos LGPD:
 * - Campos sensíveis (CPF, segredo TOTP, códigos de backup) armazenados criptografados.
 * - Chave gerenciada via variável de ambiente ENCRYPTION_KEY (nunca junto aos dados).
 * - IV aleatório por criptografia, armazenado junto ao ciphertext.
 * - HMAC com chave independente para índice de busca (evita descriptografar todos os registros).
 * - Versionamento dos dados criptografados para rotação de chave.
 * - Falha segura quando chaves obrigatórias estão ausentes.
 */

import { createCipheriv, createDecipheriv, randomBytes, scrypt, createHmac, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const VERSION_PREFIX = "tf:enc:v1:";

/**
 * Versão do esquema de criptografia. Incrementar quando mudar o algoritmo ou formato.
 */
export const ENCRYPTION_VERSION = 1;

/**
 * Tamanho mínimo esperado para uma ENCRYPTION_KEY segura.
 */
const MIN_KEY_LENGTH = 32;

/**
 * Valida e retorna a chave mestra de criptografia.
 * Falha de forma segura se a chave estiver ausente ou for fraca.
 */
function getMasterKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY não configurada. Defina uma chave de 32+ caracteres para criptografia de dados sensíveis."
    );
  }
  if (key.length < MIN_KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY muito curta. Mínimo de ${MIN_KEY_LENGTH} caracteres exigido.`
    );
  }
  return key;
}

/**
 * Valida e retorna a chave HMAC para índice de busca.
 */
function getHmacKey(): string {
  const key = process.env.ENCRYPTION_HMAC_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_HMAC_KEY não configurada. Defina uma chave independente para HMAC de busca."
    );
  }
  if (key.length < MIN_KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_HMAC_KEY muito curta. Mínimo de ${MIN_KEY_LENGTH} caracteres exigido.`
    );
  }
  return key;
}

/**
 * Criptografa uma string.
 * Retorna: VERSION_PREFIX + salt + iv + tag + ciphertext (base64url).
 *
 * @throws Error se ENCRYPTION_KEY não estiver configurada ou for inválida.
 */
export async function encrypt(plaintext: string): Promise<string> {
  const masterKey = getMasterKey();
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  const cipherKey = await scryptAsync(masterKey, salt, KEY_LENGTH);
  const cipher = createCipheriv(ALGORITHM, cipherKey as Buffer, iv);

  const encryptedParts: Buffer[] = [];
  encryptedParts.push(cipher.update(plaintext, "utf8"));
  encryptedParts.push(cipher.final());
  const ciphertext = Buffer.concat(encryptedParts);
  const tag = cipher.getAuthTag();

  const payload = Buffer.concat([salt, iv, tag, ciphertext]);
  return VERSION_PREFIX + payload.toString("base64url");
}

/**
 * Descriptografa uma string previamente criptografada com encrypt().
 *
 * @throws Error se o formato não for reconhecido ou a descriptografia falhar.
 */
export async function decrypt(encryptedData: string): Promise<string> {
  const masterKey = getMasterKey();

  if (!encryptedData.startsWith(VERSION_PREFIX)) {
    throw new Error("Formato de dados criptografado não reconhecido.");
  }

  const payload = Buffer.from(encryptedData.slice(VERSION_PREFIX.length), "base64url");

  if (payload.length < SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("Payload criptografado muito curto.");
  }

  const salt = payload.subarray(0, SALT_LENGTH);
  const iv = payload.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = payload.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const ciphertext = payload.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const cipherKey = await scryptAsync(masterKey, salt, KEY_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, cipherKey as Buffer, iv);
  decipher.setAuthTag(tag);

  const decryptedParts: Buffer[] = [];
  decryptedParts.push(decipher.update(ciphertext));
  decryptedParts.push(decipher.final());
  return Buffer.concat(decryptedParts).toString("utf8");
}

/**
 * Verifica se uma string está no formato criptografado (versão v1).
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  return value.startsWith(VERSION_PREFIX);
}

/**
 * Gera um HMAC determinístico para um valor, permitindo busca por índice
 * sem descriptografar todos os registros. Usa chave independente da criptografia.
 *
 * @throws Error se ENCRYPTION_HMAC_KEY não estiver configurada.
 */
export function generateHmacIndex(value: string): string {
  const hmacKey = getHmacKey();
  const hmac = createHmac("sha256", hmacKey);
  hmac.update(value.trim().toLowerCase());
  return hmac.digest("hex");
}

/**
 * Compara dois valores HMAC de forma segura (ataque de tempo constante).
 */
export function verifyHmacIndex(value: string, expectedHmac: string): boolean {
  const computed = generateHmacIndex(value);
  return timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(expectedHmac, "hex"));
}

/**
 * Mascara um CPF: exibe apenas os últimos 2 dígitos.
 * Ex: 123.456.789-01 → ***.456.***-**-01
 */
export function maskCpf(cpf: string | null | undefined): string | null | undefined {
  if (!cpf) return cpf;
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `***.${digits.slice(3, 6)}.***-**-${digits.slice(9, 11)}`;
}

/**
 * Mascara um telefone: exibe apenas DDD e últimos 2 dígitos.
 * Ex: (11) 98765-4321 → (11) ****-4321
 */
export function maskPhone(phone: string | null | undefined): string | null | undefined {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return phone;
  return `(${digits.slice(0, 2)}) ****-${digits.slice(-4)}`;
}

/**
 * Mascara um e-mail: exibe apenas a primeira letra e o domínio.
 * Ex: joao@empresa.com → j***@empresa.com
 */
export function maskEmail(email: string | null | undefined): string | null | undefined {
  if (!email) return email;
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local.charAt(0)}***@${domain}`;
}

/**
 * Valida o formato de CPF (apenas dígitos, 11 posições, não todos iguais).
 */
export function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits.charAt(i)) * (10 - i);
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(digits.charAt(9)) !== digit1) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits.charAt(i)) * (11 - i);
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  return parseInt(digits.charAt(10)) === digit2;
}
