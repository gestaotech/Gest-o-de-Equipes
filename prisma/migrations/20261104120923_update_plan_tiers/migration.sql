-- Alterar enum PlanTier: substituir STARTER, PROFESSIONAL, BUSINESS, ENTERPRISE por MENSAL, ANUAL, ECOSISTEMA

-- Passo 1: Adicionar novos valores ao enum
ALTER TYPE "PlanTier" ADD VALUE IF NOT EXISTS 'MENSAL';
ALTER TYPE "PlanTier" ADD VALUE IF NOT EXISTS 'ANUAL';
ALTER TYPE "PlanTier" ADD VALUE IF NOT EXISTS 'ECOSISTEMA';

-- Passo 2: Atualizar planos existentes para os novos valores (se houver dados)
-- Mapeamento: STARTER -> MENSAL, PROFESSIONAL -> ANUAL, BUSINESS/ENTERPRISE -> ECOSISTEMA
UPDATE "plans" SET tier = 'MENSAL' WHERE tier = 'STARTER';
UPDATE "plans" SET tier = 'ANUAL' WHERE tier = 'PROFESSIONAL';
UPDATE "plans" SET tier = 'ECOSISTEMA' WHERE tier IN ('BUSINESS', 'ENTERPRISE');

-- Passo 3: Remover valores antigos do enum
-- Em PostgreSQL, não é possível remover valores de um enum diretamente se houver dependências.
-- Como alternativa, recriamos o tipo com os novos valores.
-- Esta abordagem requer que não haja dados usando os valores antigos após o UPDATE acima.

ALTER TYPE "PlanTier" RENAME TO "PlanTier_old";

CREATE TYPE "PlanTier" AS ENUM ('MENSAL', 'ANUAL', 'ECOSISTEMA');

ALTER TABLE "plans" ALTER COLUMN tier TYPE "PlanTier" USING tier::text::"PlanTier";

DROP TYPE "PlanTier_old";
