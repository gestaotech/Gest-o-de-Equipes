-- Migration: Criptografia de campos sensíveis (CPF, TOTP secret, backup codes)
-- Adiciona campos criptografados e índices HMAC para busca segura.
-- Os campos originais (cpf, secret, backupCodes) são mantidos temporariamente
-- para permitir migração de dados existentes sem perda.

-- ------------------------------------------------------------
-- TABELA organization_members - Campos criptografados de CPF
-- ------------------------------------------------------------

-- Adicionar campos criptografados (nullable para permitir migração gradual)
ALTER TABLE "organization_members" ADD COLUMN "cpfEncrypted" TEXT;
ALTER TABLE "organization_members" ADD COLUMN "cpfHmacIndex" TEXT;

-- Índice para busca rápida por CPF criptografado via HMAC
CREATE INDEX IF NOT EXISTS "organization_members_cpfHmacIndex_idx" ON "organization_members"("cpfHmacIndex");

-- ------------------------------------------------------------
-- TABELA user_two_factor - Segredo TOTP criptografado e backup codes hash
-- ------------------------------------------------------------

-- Adicionar campo criptografado para segredo TOTP
ALTER TABLE "user_two_factor" ADD COLUMN "secretEncrypted" TEXT;

-- Substituir backupCodes (texto puro) por backupCodesHash (hash SHA-256)
ALTER TABLE "user_two_factor" ADD COLUMN "backupCodesHash" TEXT;

-- ------------------------------------------------------------
-- NOTA: Migração de dados existentes
-- ------------------------------------------------------------
-- Os campos originais (cpf, secret, backupCodes) são mantidos para
-- permitir que a aplicação faça a migração de dados gradualmente.
-- A aplicação deve:
-- 1. Ler o campo em texto puro
-- 2. Criptografar e salvar no novo campo
-- 3. Gerar HMAC index e salvar
-- 4. Marcar o registro como migrado (ou limpar o campo antigo após validação)
-- 5. Apenas após todos os registros estarem migrados, remover os campos antigos

-- ------------------------------------------------------------
-- Índices adicionais para performance
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "organization_members_cpfEncrypted_idx" ON "organization_members"("cpfEncrypted");
