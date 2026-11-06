-- Migration: LGPD Governança e Direitos dos Titulares
-- Adiciona modelos: LGPDRequest, LGPDRequestHistory, ProcessingRecord, PrivacyPolicy, Consent, RetentionPolicy, SecurityIncident

-- ------------------------------------------------------------
-- ENUMS LGPD
-- ------------------------------------------------------------

CREATE TYPE "LGPDRequestType" AS ENUM ('ACCESS', 'CORRECTION', 'ANONYMIZATION', 'PORTABILITY', 'DELETION', 'REVOCATION', 'OPPOSITION', 'OTHER');
CREATE TYPE "LGPDRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');
CREATE TYPE "DataCategory" AS ENUM ('IDENTIFICATION', 'CONTACT', 'EMPLOYMENT', 'AUTHENTICATION', 'DEVICE', 'BEHAVIORAL', 'FINANCIAL', 'HEALTH', 'BIOMETRIC', 'OTHER');
CREATE TYPE "LegalBasis" AS ENUM ('CONSENT', 'LEGAL_OBLIGATION', 'PUBLIC_POLICY', 'CONTRACT', 'LEGITIMATE_INTEREST', 'VITAL_INTEREST', 'LEGAL_EXERCISE', 'OTHER');
CREATE TYPE "SharingType" AS ENUM ('NONE', 'THIRD_PARTY_PROCESSOR', 'CONTROLLER', 'AUTHORITY', 'OTHER');
CREATE TYPE "RetentionStatus" AS ENUM ('ACTIVE', 'SCHEDULED_FOR_DELETION', 'DELETED', 'ANONYMIZED', 'RETAINED_LEGAL');
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED');

-- ------------------------------------------------------------
-- TABELA lgpd_requests
-- ------------------------------------------------------------

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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lgpd_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lgpd_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
    CONSTRAINT "lgpd_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "lgpd_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE SET NULL,
    CONSTRAINT "lgpd_requests_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "lgpd_requests_organizationId_idx" ON "lgpd_requests"("organizationId");
CREATE INDEX "lgpd_requests_userId_idx" ON "lgpd_requests"("userId");
CREATE INDEX "lgpd_requests_status_idx" ON "lgpd_requests"("status");
CREATE INDEX "lgpd_requests_type_idx" ON "lgpd_requests"("type");

-- ------------------------------------------------------------
-- TABELA lgpd_request_history
-- ------------------------------------------------------------

CREATE TABLE "lgpd_request_history" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "status" "LGPDRequestStatus" NOT NULL,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT,

    CONSTRAINT "lgpd_request_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lgpd_request_history_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "lgpd_requests"("id") ON DELETE CASCADE,
    CONSTRAINT "lgpd_request_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "lgpd_request_history_requestId_idx" ON "lgpd_request_history"("requestId");

-- ------------------------------------------------------------
-- TABELA processing_records (ROPA)
-- ------------------------------------------------------------

CREATE TYPE "data_category_enum" AS ENUM ('IDENTIFICATION', 'CONTACT', 'EMPLOYMENT', 'AUTHENTICATION', 'DEVICE', 'BEHAVIORAL', 'FINANCIAL', 'HEALTH', 'BIOMETRIC', 'OTHER');

CREATE TABLE "processing_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "purpose" TEXT NOT NULL,
    "legalBasis" "LegalBasis" NOT NULL,
    "dataCategory" "data_category_enum"[] NOT NULL DEFAULT '{}',
    "subjectCategory" "data_category_enum"[] NOT NULL DEFAULT '{}',
    "sharing" "SharingType" NOT NULL DEFAULT 'NONE',
    "sharedWith" TEXT,
    "retentionPeriod" TEXT,
    "securityMeasures" TEXT,
    "dpoResponsible" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "processing_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE
);

CREATE INDEX "processing_records_organizationId_idx" ON "processing_records"("organizationId");

-- ------------------------------------------------------------
-- TABELA privacy_policies
-- ------------------------------------------------------------

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

    CONSTRAINT "privacy_policies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "privacy_policies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
    CONSTRAINT "privacy_policies_organizationId_version_key" UNIQUE ("organizationId", "version")
);

CREATE INDEX "privacy_policies_organizationId_idx" ON "privacy_policies"("organizationId");

-- ------------------------------------------------------------
-- TABELA consents
-- ------------------------------------------------------------

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

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "consents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
    CONSTRAINT "consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "consents_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "privacy_policies"("id") ON DELETE CASCADE,
    CONSTRAINT "consents_userId_policyId_key" UNIQUE ("userId", "policyId")
);

CREATE INDEX "consents_organizationId_idx" ON "consents"("organizationId");
CREATE INDEX "consents_userId_idx" ON "consents"("userId");

-- ------------------------------------------------------------
-- TABELA retention_policies
-- ------------------------------------------------------------

CREATE TYPE "retention_status_enum" AS ENUM ('ACTIVE', 'SCHEDULED_FOR_DELETION', 'DELETED', 'ANONYMIZED', 'RETAINED_LEGAL');

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

    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "retention_policies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE
);

CREATE INDEX "retention_policies_organizationId_idx" ON "retention_policies"("organizationId");
CREATE INDEX "retention_policies_entityType_idx" ON "retention_policies"("entityType");

-- ------------------------------------------------------------
-- TABELA security_incidents
-- ------------------------------------------------------------

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

    CONSTRAINT "security_incidents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "security_incidents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
    CONSTRAINT "security_incidents_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "security_incidents_organizationId_idx" ON "security_incidents"("organizationId");
CREATE INDEX "security_incidents_status_idx" ON "security_incidents"("status");
CREATE INDEX "security_incidents_severity_idx" ON "security_incidents"("severity");
