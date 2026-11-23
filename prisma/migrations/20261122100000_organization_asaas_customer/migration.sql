-- AddColumn
ALTER TABLE "organizations" ADD COLUMN "asaasCustomerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_asaasCustomerId_key" ON "organizations"("asaasCustomerId");