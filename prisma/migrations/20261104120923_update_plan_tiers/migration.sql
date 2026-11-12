-- Alterar enum PlanTier: substituir STARTER, PROFESSIONAL, BUSINESS, ENTERPRISE por MENSAL, ANUAL, ECOSISTEMA
-- Mapeamento: STARTER -> MENSAL, PROFESSIONAL -> ANUAL, BUSINESS/ENTERPRISE -> ECOSISTEMA
-- O mapeamento é feito no próprio ALTER COLUMN. Não usar ALTER TYPE ... ADD VALUE seguido de UPDATE
-- com o novo valor: o PostgreSQL recusa ("unsafe use of new value") na mesma transação.

CREATE TYPE "PlanTier_new" AS ENUM ('MENSAL', 'ANUAL', 'ECOSISTEMA');

ALTER TABLE "plans" ALTER COLUMN "tier" TYPE "PlanTier_new" USING (
  CASE "tier"::text
    WHEN 'STARTER' THEN 'MENSAL'
    WHEN 'PROFESSIONAL' THEN 'ANUAL'
    WHEN 'BUSINESS' THEN 'ECOSISTEMA'
    WHEN 'ENTERPRISE' THEN 'ECOSISTEMA'
  END
)::"PlanTier_new";

ALTER TYPE "PlanTier" RENAME TO "PlanTier_old";
ALTER TYPE "PlanTier_new" RENAME TO "PlanTier";
DROP TYPE "PlanTier_old";
