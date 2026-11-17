-- Remove o CPF em texto puro de organization_members.
-- A criptografia acontece na aplicação (AES-256-GCM), então o SQL não consegue converter os valores.
-- Por isso a migração aborta se houver CPF em texto puro sem a versão criptografada correspondente.

DO $$
DECLARE
  pending INTEGER;
BEGIN
  SELECT COUNT(*) INTO pending
  FROM "organization_members"
  WHERE "cpf" IS NOT NULL AND "cpf" <> '' AND "cpfEncrypted" IS NULL;

  IF pending > 0 THEN
    RAISE EXCEPTION 'Abortado: % registro(s) com CPF em texto puro sem cpfEncrypted. Migre-os antes de remover a coluna.', pending;
  END IF;
END $$;

ALTER TABLE "organization_members" DROP COLUMN "cpf";
