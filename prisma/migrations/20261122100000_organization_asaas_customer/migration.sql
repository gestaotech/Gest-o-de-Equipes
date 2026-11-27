<<<<<<< HEAD
-- AddColumn
ALTER TABLE "organizations" ADD COLUMN "asaasCustomerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_asaasCustomerId_key" ON "organizations"("asaasCustomerId");
=======
ALTER TABLE "organizations" ADD COLUMN "asaasCustomerId" TEXT;

CREATE UNIQUE INDEX "organizations_asaasCustomerId_key"
ON "organizations"("asaasCustomerId");
>>>>>>> 5da453bd8add7d1a97c12b78146089988231f7ee
