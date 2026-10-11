-- CreateEnum
CREATE TYPE "AccountTokenType" AS ENUM ('FIRST_ACCESS', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "account_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "type" "AccountTokenType" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_tokens_tokenHash_key" ON "account_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "account_tokens_userId_idx" ON "account_tokens"("userId");

-- CreateIndex
CREATE INDEX "account_tokens_userId_type_usedAt_idx" ON "account_tokens"("userId", "type", "usedAt");

-- AddForeignKey
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
