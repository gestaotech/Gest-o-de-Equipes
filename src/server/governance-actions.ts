"use server";

import { prisma } from "@/lib/prisma";
import { handleAction, AppError, ok } from "@/lib/errors";
import { requireSessionApi } from "@/lib/auth";
import { requireDataScope } from "@/server/scope";
import { logActivity } from "@/server/activity";
import z from "zod";
import { DataCategory, DataSubjectCategory, LegalBasis, SharingType, IncidentSeverity } from "@prisma/client";

// ============================================================================
// PROCESSING RECORDS (ROPA - Registro de Operações de Tratamento)
// ============================================================================

const processingRecordSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório.").max(200),
  description: z.string().optional(),
  purpose: z.string().min(2, "Finalidade é obrigatória.").max(1000),
  legalBasis: z.nativeEnum(LegalBasis),
  dataCategory: z.array(z.nativeEnum(DataCategory)).default([]),
  subjectCategory: z.array(z.nativeEnum(DataCategory)).default([]),
  dataSubjects: z.array(z.nativeEnum(DataSubjectCategory)).default([]),
  sharing: z.nativeEnum(SharingType).default("NONE"),
  sharedWith: z.string().optional(),
  retentionPeriod: z.string().optional(),
  securityMeasures: z.string().optional(),
  dpoResponsible: z.string().optional(),
});

export async function listProcessingRecords() {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const records = await prisma.processingRecord.findMany({
      where: { organizationId: scope.orgId },
      orderBy: { createdAt: "desc" },
    });

    return ok({ records });
  });
}

export async function createProcessingRecord(input: unknown) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const data = processingRecordSchema.parse(input);

    const record = await prisma.processingRecord.create({
      data: {
        organizationId: scope.orgId,
        name: data.name,
        description: data.description,
        purpose: data.purpose,
        legalBasis: data.legalBasis,
        dataCategory: data.dataCategory,
        subjectCategory: data.subjectCategory,
        dataSubjects: data.dataSubjects,
        sharing: data.sharing,
        sharedWith: data.sharedWith,
        retentionPeriod: data.retentionPeriod,
        securityMeasures: data.securityMeasures,
        dpoResponsible: data.dpoResponsible,
      },
    });

    await logActivity({
      action: "governance.processing_record.created",
      entity: "processing_record",
      entityId: record.id,
      newData: { name: data.name, purpose: data.purpose },
    });

    return ok({ record });
  });
}

export async function updateProcessingRecord(input: { id: string } & Record<string, unknown>) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const data = processingRecordSchema.parse(input);

    const record = await prisma.processingRecord.findFirst({
      where: { id: input.id, organizationId: scope.orgId },
    });
    if (!record) {
      throw new AppError("NOT_FOUND", "Registro de tratamento não encontrado.", 404);
    }

    const updated = await prisma.processingRecord.update({
      where: { id: input.id },
      data: {
        name: data.name,
        description: data.description,
        purpose: data.purpose,
        legalBasis: data.legalBasis,
        dataCategory: data.dataCategory,
        subjectCategory: data.subjectCategory,
        dataSubjects: data.dataSubjects,
        sharing: data.sharing,
        sharedWith: data.sharedWith,
        retentionPeriod: data.retentionPeriod,
        securityMeasures: data.securityMeasures,
        dpoResponsible: data.dpoResponsible,
      },
    });

    await logActivity({
      action: "governance.processing_record.updated",
      entity: "processing_record",
      entityId: input.id,
      newData: { name: data.name },
    });

    return ok({ record: updated });
  });
}

export async function deleteProcessingRecord(id: string) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const record = await prisma.processingRecord.findFirst({
      where: { id, organizationId: scope.orgId },
    });
    if (!record) {
      throw new AppError("NOT_FOUND", "Registro de tratamento não encontrado.", 404);
    }

    await prisma.processingRecord.delete({ where: { id } });

    await logActivity({
      action: "governance.processing_record.deleted",
      entity: "processing_record",
      entityId: id,
      newData: { name: record.name },
    });

    return ok({});
  });
}

// ============================================================================
// PRIVACY POLICIES (Política de Privacidade Versionada)
// ============================================================================

const privacyPolicySchema = z.object({
  title: z.string().min(2, "Título é obrigatório.").max(200),
  version: z.string().min(1, "Versão é obrigatória.").max(50),
  content: z.string().min(10, "Conteúdo é obrigatório."),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
  isActive: z.boolean().default(false),
});

export async function listPrivacyPolicies() {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const policies = await prisma.privacyPolicy.findMany({
      where: { organizationId: scope.orgId },
      orderBy: { createdAt: "desc" },
    });

    return ok({ policies });
  });
}

export async function createPrivacyPolicy(input: unknown) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const data = privacyPolicySchema.parse(input);

    // Se está ativando esta política, desativa as outras
    if (data.isActive) {
      await prisma.privacyPolicy.updateMany({
        where: { organizationId: scope.orgId },
        data: { isActive: false },
      });
    }

    const policy = await prisma.privacyPolicy.create({
      data: {
        organizationId: scope.orgId,
        title: data.title,
        version: data.version,
        content: data.content,
        effectiveFrom: new Date(data.effectiveFrom),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
        isActive: data.isActive,
      },
    });

    await logActivity({
      action: "governance.privacy_policy.created",
      entity: "privacy_policy",
      entityId: policy.id,
      newData: { title: data.title, version: data.version, isActive: data.isActive },
    });

    return ok({ policy });
  });
}

export async function setActivePrivacyPolicy(policyId: string) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const policy = await prisma.privacyPolicy.findFirst({
      where: { id: policyId, organizationId: scope.orgId },
    });
    if (!policy) {
      throw new AppError("NOT_FOUND", "Política de privacidade não encontrada.", 404);
    }

    // Desativa todas e ativa a selecionada
    await prisma.privacyPolicy.updateMany({
      where: { organizationId: scope.orgId },
      data: { isActive: false },
    });
    await prisma.privacyPolicy.update({
      where: { id: policyId },
      data: { isActive: true },
    });

    await logActivity({
      action: "governance.privacy_policy.activated",
      entity: "privacy_policy",
      entityId: policyId,
      newData: { isActive: true },
    });

    return ok({ policyId, isActive: true });
  });
}

// ============================================================================
// CONSENTS (Aceite de Consentimento)
// ============================================================================

const consentSchema = z.object({
  policyId: z.string().min(1),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export async function grantConsent(input: unknown) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const data = consentSchema.parse(input);

    const policy = await prisma.privacyPolicy.findFirst({
      where: { id: data.policyId, organizationId: scope.orgId, isActive: true },
    });
    if (!policy) {
      throw new AppError("NOT_FOUND", "Política de privacidade ativa não encontrada.", 404);
    }

    const consent = await prisma.consent.upsert({
      where: { userId_policyId: { userId: session.sub, policyId: data.policyId } },
      create: {
        organizationId: scope.orgId,
        userId: session.sub,
        policyId: data.policyId,
        version: policy.version,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
      update: {
        version: policy.version,
        grantedAt: new Date(),
        revokedAt: null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });

    await logActivity({
      action: "governance.consent.granted",
      entity: "consent",
      entityId: consent.id,
      newData: { policyId: data.policyId, version: policy.version },
    });

    return ok({ consent });
  });
}

export async function revokeConsent(policyId: string) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const consent = await prisma.consent.findFirst({
      where: { userId: session.sub, policyId, organizationId: scope.orgId },
    });
    if (!consent) {
      throw new AppError("NOT_FOUND", "Consentimento não encontrado.", 404);
    }

    const updated = await prisma.consent.update({
      where: { id: consent.id },
      data: { revokedAt: new Date() },
    });

    await logActivity({
      action: "governance.consent.revoked",
      entity: "consent",
      entityId: consent.id,
      newData: { policyId, revokedAt: new Date() },
    });

    return ok({ consent: updated });
  });
}

export async function listConsents() {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const consents = await prisma.consent.findMany({
      where: { userId: session.sub, organizationId: scope.orgId },
      include: { policy: { select: { id: true, title: true, version: true } } },
      orderBy: { grantedAt: "desc" },
    });

    return ok({ consents });
  });
}

// ============================================================================
// RETENTION POLICIES (Políticas de Retenção)
// ============================================================================

const retentionPolicySchema = z.object({
  entityType: z.string().min(1),
  entityField: z.string().optional(),
  condition: z.string().min(1),
  action: z.string().min(1),
  retentionDays: z.number().min(1),
  legalBasis: z.string().optional(),
  isActive: z.boolean().default(true),
});

export async function listRetentionPolicies() {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const policies = await prisma.retentionPolicy.findMany({
      where: { organizationId: scope.orgId },
      orderBy: { createdAt: "desc" },
    });

    return ok({ policies });
  });
}

export async function createRetentionPolicy(input: unknown) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const data = retentionPolicySchema.parse(input);

    const policy = await prisma.retentionPolicy.create({
      data: {
        organizationId: scope.orgId,
        entityType: data.entityType,
        entityField: data.entityField,
        condition: data.condition,
        action: data.action,
        retentionDays: data.retentionDays,
        legalBasis: data.legalBasis,
        isActive: data.isActive,
      },
    });

    await logActivity({
      action: "governance.retention_policy.created",
      entity: "retention_policy",
      entityId: policy.id,
      newData: { entityType: data.entityType, action: data.action },
    });

    return ok({ policy });
  });
}

// ============================================================================
// SECURITY INCIDENTS (Gestão de Incidentes)
// ============================================================================

const securityIncidentSchema = z.object({
  title: z.string().min(2, "Título é obrigatório.").max(200),
  description: z.string().min(10, "Descrição é obrigatória."),
  category: z.string().min(1),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  systemsAffected: z.string().optional(),
  dataCompromised: z.string().optional(),
  subjectsAffected: z.number().optional(),
  organizationsAffected: z.number().optional(),
  containmentMeasures: z.string().optional(),
  responsePlan: z.string().optional(),
  responsibleId: z.string().optional(),
  evidenceUrl: z.string().optional(),
});

export async function listSecurityIncidents() {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const incidents = await prisma.securityIncident.findMany({
      where: { organizationId: scope.orgId },
      include: {
        responsible: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok({ incidents });
  });
}

export async function createSecurityIncident(input: unknown) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const data = securityIncidentSchema.parse(input);

    const incident = await prisma.securityIncident.create({
      data: {
        organizationId: scope.orgId,
        title: data.title,
        description: data.description,
        category: data.category,
        severity: data.severity,
        systemsAffected: data.systemsAffected,
        dataCompromised: data.dataCompromised,
        subjectsAffected: data.subjectsAffected,
        organizationsAffected: data.organizationsAffected,
        containmentMeasures: data.containmentMeasures,
        responsePlan: data.responsePlan,
        responsibleId: data.responsibleId || session.sub,
        evidenceUrl: data.evidenceUrl,
      },
      include: {
        responsible: { select: { id: true, name: true, email: true } },
      },
    });

    await logActivity({
      action: "governance.security_incident.created",
      entity: "security_incident",
      entityId: incident.id,
      newData: { title: data.title, severity: data.severity },
    });

    return ok({ incident });
  });
}

export async function updateSecurityIncident(input: { id: string } & Record<string, unknown>) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const data = securityIncidentSchema.parse(input);

    const incident = await prisma.securityIncident.findFirst({
      where: { id: input.id, organizationId: scope.orgId },
    });
    if (!incident) {
      throw new AppError("NOT_FOUND", "Incidente não encontrado.", 404);
    }

    const updated = await prisma.securityIncident.update({
      where: { id: input.id },
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        severity: data.severity,
        systemsAffected: data.systemsAffected,
        dataCompromised: data.dataCompromised,
        subjectsAffected: data.subjectsAffected,
        organizationsAffected: data.organizationsAffected,
        containmentMeasures: data.containmentMeasures,
        responsePlan: data.responsePlan,
        evidenceUrl: data.evidenceUrl,
        ...(incident.status === "RESOLVED" ? {} : {}),
      },
      include: {
        responsible: { select: { id: true, name: true, email: true } },
      },
    });

    await logActivity({
      action: "governance.security_incident.updated",
      entity: "security_incident",
      entityId: input.id,
      newData: { title: data.title, severity: data.severity },
    });

    return ok({ incident: updated });
  });
}

export async function resolveSecurityIncident(incidentId: string) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const incident = await prisma.securityIncident.findFirst({
      where: { id: incidentId, organizationId: scope.orgId },
    });
    if (!incident) {
      throw new AppError("NOT_FOUND", "Incidente não encontrado.", 404);
    }

    const updated = await prisma.securityIncident.update({
      where: { id: incidentId },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });

    await logActivity({
      action: "governance.security_incident.resolved",
      entity: "security_incident",
      entityId: incidentId,
      newData: { status: "RESOLVED", resolvedAt: new Date() },
    });

    return ok({ incident: updated });
  });
}
