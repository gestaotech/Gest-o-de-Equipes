-- Alinha o banco ao schema atual sem apagar dados.
-- Base: `prisma migrate diff` (banco -> schema), com ajustes manuais:
--   * PlanTier: mapeamento explícito STARTER/PROFESSIONAL/BUSINESS/ENTERPRISE -> MENSAL/ANUAL/ECOSISTEMA
--   * subscriptions: renomeada para "Subscription" (sem DROP, linhas preservadas)
--   * webhook_events fica na própria migration 20261112120000_webhook_events

BEGIN;

-- AlterEnum PlanTier
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

-- Valores do catálogo (src/lib/catalog.ts)
UPDATE "plans" SET "name" = 'Mensal', "maxUsers" = 20, "maxTeams" = 5, "maxProjects" = 20, "advancedReports" = false, "integrations" = false, "aiFeatures" = false, "priceMonthly" = 150, "priceYearly" = 0 WHERE "tier" = 'MENSAL';
UPDATE "plans" SET "name" = 'Anual', "maxUsers" = 100, "maxTeams" = 20, "maxProjects" = NULL, "advancedReports" = true, "integrations" = true, "aiFeatures" = false, "priceMonthly" = 0, "priceYearly" = 1500 WHERE "tier" = 'ANUAL';
UPDATE "plans" SET "name" = 'Integração com Ecossistema', "maxUsers" = NULL, "maxTeams" = NULL, "maxProjects" = NULL, "advancedReports" = true, "integrations" = true, "aiFeatures" = true, "priceMonthly" = 0, "priceYearly" = 0 WHERE "tier" = 'ECOSISTEMA';

-- AlterEnum SubscriptionStatus
ALTER TYPE "SubscriptionStatus" ADD VALUE 'REFUNDED';

-- Subscription: renomeação de subscriptions (dados preservados)
ALTER TABLE "subscriptions" RENAME TO "Subscription";
ALTER TABLE "Subscription" RENAME CONSTRAINT "subscriptions_pkey" TO "Subscription_pkey";
ALTER TABLE "Subscription" RENAME CONSTRAINT "subscriptions_organizationId_fkey" TO "Subscription_organizationId_fkey";
ALTER TABLE "Subscription" RENAME CONSTRAINT "subscriptions_planId_fkey" TO "Subscription_planId_fkey";
ALTER INDEX "subscriptions_organizationId_idx" RENAME TO "Subscription_organizationId_idx";
ALTER TABLE "Subscription"
  ADD COLUMN "trialDays" INTEGER DEFAULT 0,
  ADD COLUMN "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'ASAAS',
  ADD COLUMN "provider_customer_id" TEXT,
  ADD COLUMN "provider_subscription_id" TEXT;
CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");

-- Invoice: uma fatura por assinatura (como no schema atual)
CREATE UNIQUE INDEX "invoices_subscriptionId_key" ON "invoices"("subscriptionId");

-- Enums
CREATE TYPE "AccountTokenType" AS ENUM ('FIRST_ACCESS', 'PASSWORD_RESET');
CREATE TYPE "ParticipantStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');
CREATE TYPE "LGPDRequestType" AS ENUM ('ACCESS', 'CORRECTION', 'ANONYMIZATION', 'PORTABILITY', 'DELETION', 'REVOCATION', 'OPPOSITION', 'OTHER');
CREATE TYPE "LGPDRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');
CREATE TYPE "DataCategory" AS ENUM ('IDENTIFICATION', 'CONTACT', 'EMPLOYMENT', 'AUTHENTICATION', 'DEVICE', 'BEHAVIORAL', 'FINANCIAL', 'HEALTH', 'BIOMETRIC', 'OTHER');
CREATE TYPE "DataSubjectCategory" AS ENUM ('EMPLOYEE', 'MEMBER', 'CUSTOMER', 'PARTNER', 'OTHER');
CREATE TYPE "LegalBasis" AS ENUM ('CONSENT', 'LEGAL_OBLIGATION', 'PUBLIC_POLICY', 'CONTRACT', 'LEGITIMATE_INTEREST', 'VITAL_INTEREST', 'LEGAL_EXERCISE', 'OTHER');
CREATE TYPE "SharingType" AS ENUM ('NONE', 'THIRD_PARTY_PROCESSOR', 'CONTROLLER', 'AUTHORITY', 'OTHER');
CREATE TYPE "RetentionStatus" AS ENUM ('ACTIVE', 'SCHEDULED_FOR_DELETION', 'DELETED', 'ANONYMIZED', 'RETAINED_LEGAL');
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED');

-- Colunas novas em tabelas existentes
ALTER TABLE "organization_members" ADD COLUMN "cpf" TEXT, ADD COLUMN "cpfEncrypted" TEXT, ADD COLUMN "cpfHmacIndex" TEXT;
CREATE INDEX "organization_members_cpfHmacIndex_idx" ON "organization_members"("cpfHmacIndex");
ALTER TABLE "user_preferences" ADD COLUMN "dashboardConfig" JSONB DEFAULT '{}';

-- Tabelas novas
CREATE TABLE "user_two_factor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "secretEncrypted" TEXT NOT NULL,
    "backupCodesHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_two_factor_pkey" PRIMARY KEY ("id")
);

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

CREATE TABLE "event_participants" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lgpd_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requesterId" TEXT,
    "type" "LGPDRequestType" NOT NULL,
    "status" "LGPDRequestStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "legalBasis" TEXT,
    "responseDeadline" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lgpd_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lgpd_request_history" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "status" "LGPDRequestStatus" NOT NULL,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT,

    CONSTRAINT "lgpd_request_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "processing_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "purpose" TEXT NOT NULL,
    "legalBasis" "LegalBasis" NOT NULL,
    "dataCategory" "DataCategory"[],
    "subjectCategory" "DataCategory"[],
    "dataSubjects" "DataSubjectCategory"[],
    "sharing" "SharingType" NOT NULL DEFAULT 'NONE',
    "sharedWith" TEXT,
    "retentionPeriod" TEXT,
    "securityMeasures" TEXT,
    "dpoResponsible" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "privacy_policies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privacy_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "retention_policies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityField" TEXT,
    "condition" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "legalBasis" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "security_incidents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "systemsAffected" TEXT,
    "dataCompromised" TEXT,
    "subjectsAffected" INTEGER,
    "organizationsAffected" INTEGER,
    "containmentMeasures" TEXT,
    "responsePlan" TEXT,
    "responsibleId" TEXT,
    "evidenceUrl" TEXT,
    "notifiedAuthorityAt" TIMESTAMP(3),
    "notifiedSubjectsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "security_incidents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rate_limit_records" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_records_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE UNIQUE INDEX "user_two_factor_userId_key" ON "user_two_factor"("userId");
CREATE UNIQUE INDEX "account_tokens_tokenHash_key" ON "account_tokens"("tokenHash");
CREATE INDEX "account_tokens_userId_idx" ON "account_tokens"("userId");
CREATE INDEX "account_tokens_userId_type_usedAt_idx" ON "account_tokens"("userId", "type", "usedAt");
CREATE INDEX "event_participants_eventId_idx" ON "event_participants"("eventId");
CREATE INDEX "event_participants_userId_idx" ON "event_participants"("userId");
CREATE INDEX "event_participants_status_idx" ON "event_participants"("status");
CREATE UNIQUE INDEX "event_participants_eventId_userId_key" ON "event_participants"("eventId", "userId");
CREATE INDEX "lgpd_requests_organizationId_idx" ON "lgpd_requests"("organizationId");
CREATE INDEX "lgpd_requests_userId_idx" ON "lgpd_requests"("userId");
CREATE INDEX "lgpd_requests_status_idx" ON "lgpd_requests"("status");
CREATE INDEX "lgpd_requests_type_idx" ON "lgpd_requests"("type");
CREATE INDEX "lgpd_request_history_requestId_idx" ON "lgpd_request_history"("requestId");
CREATE INDEX "processing_records_organizationId_idx" ON "processing_records"("organizationId");
CREATE INDEX "privacy_policies_organizationId_idx" ON "privacy_policies"("organizationId");
CREATE UNIQUE INDEX "privacy_policies_organizationId_version_key" ON "privacy_policies"("organizationId", "version");
CREATE INDEX "consents_organizationId_idx" ON "consents"("organizationId");
CREATE INDEX "consents_userId_idx" ON "consents"("userId");
CREATE UNIQUE INDEX "consents_userId_policyId_key" ON "consents"("userId", "policyId");
CREATE INDEX "retention_policies_organizationId_idx" ON "retention_policies"("organizationId");
CREATE INDEX "retention_policies_entityType_idx" ON "retention_policies"("entityType");
CREATE INDEX "security_incidents_organizationId_idx" ON "security_incidents"("organizationId");
CREATE INDEX "security_incidents_status_idx" ON "security_incidents"("status");
CREATE INDEX "security_incidents_severity_idx" ON "security_incidents"("severity");
CREATE UNIQUE INDEX "rate_limit_records_key_key" ON "rate_limit_records"("key");
CREATE INDEX "rate_limit_records_key_idx" ON "rate_limit_records"("key");
CREATE INDEX "rate_limit_records_resetAt_idx" ON "rate_limit_records"("resetAt");
CREATE INDEX "integrations_organizationId_idx" ON "integrations"("organizationId");

-- Chaves estrangeiras (as de Subscription e invoices já existem após a renomeação)
ALTER TABLE "user_two_factor" ADD CONSTRAINT "user_two_factor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lgpd_requests" ADD CONSTRAINT "lgpd_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lgpd_requests" ADD CONSTRAINT "lgpd_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lgpd_requests" ADD CONSTRAINT "lgpd_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lgpd_requests" ADD CONSTRAINT "lgpd_requests_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lgpd_request_history" ADD CONSTRAINT "lgpd_request_history_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "lgpd_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lgpd_request_history" ADD CONSTRAINT "lgpd_request_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "processing_records" ADD CONSTRAINT "processing_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "privacy_policies" ADD CONSTRAINT "privacy_policies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "privacy_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retention_policies" ADD CONSTRAINT "retention_policies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "security_incidents" ADD CONSTRAINT "security_incidents_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
