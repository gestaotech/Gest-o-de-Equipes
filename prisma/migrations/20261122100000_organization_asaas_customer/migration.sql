ALTER TABLE "organizations" ADD COLUMN "asaasCustomerId" TEXT;

CREATE UNIQUE INDEX "organizations_asaasCustomerId_key"
ON "organizations"("asaasCustomerId");
