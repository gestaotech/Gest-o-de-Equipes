/**
 * Criptografia simétrica (AES-256-GCM) para dados pessoais sensíveis.
 *
 * Requisitos LGPD:
 * - Campos sensíveis (CPF, segredo TOTP, códigos de backup) armazenados criptografados.
 * - Chave gerenciada via variável de ambiente ENCRYPTION_KEY (nunca junto aos dados).
 * - IV aleatório por criptografia, armazenado junto ao ciphertext.
 * - HMAC com chave independente para índice de busca (evita descriptografar todos os registros).
 * - Versionamento dos dados criptografados.
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
 * Deriva uma chave de criptografia a partir da ENCRYPTION_KEY usando scrypt.
 */
async function deriveKey(masterKey: string, salt: Buffer): Promise<Buffer> {
  return (await scryptAsync(masterKey, salt, KEY_LENGTH)) as Buffer;
}

function getMasterKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY não configurada. Defina uma chave de 32+ caracteres para criptografia de dados sensíveis."
    );
  }
  return key;
}

function getHmacKey(): string {
  const key = process.env.ENCRYPTION_HMAC_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_HMAC_KEY não configurada. Defina uma chave independente para HMAC de busca."
    );
  }
  return key;
}

/**
 * Criptografa uma string. Retorna: VERSION_PREFIX + salt + iv + tag + ciphertext (base64url).
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
 */
export async function decrypt(encryptedData: string): Promise<string> {
  const masterKey = getMasterKey();

  if (!encryptedData.startsWith(VERSION_PREFIX)) {
    throw new Error("Formato de dados criptografado não reconhecido.");
  }

  const payload = Buffer.from(encryptedData.slice(VERSION_PREFIX.length), "base64url");
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
 * Gera um HMAC determinístico para um valor, permitindo busca por índice
 * sem descriptografar todos os registros.
 */
export function generateHmacIndex(value: string): string {
  const hmacKey = getHmacKey();
  const hmac = createHmac("sha256", hmacKey);
  hmac.update(value.trim().toLowerCase());
  return hmac.digest("hex");
}

/**
 * Verifica se uma string está no formato criptografado (versão v1).
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  return value.startsWith(VERSION_PREFIX);
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
