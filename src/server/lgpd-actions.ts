"use server";

import { prisma } from "@/lib/prisma";
import { handleAction, AppError, ok } from "@/lib/errors";
import { requireSessionApi } from "@/lib/auth";
import { requireDataScope } from "@/server/scope";
import { logActivity } from "@/server/activity";
import z from "zod";

const lgpdRequestSchema = z.object({
  userId: z.string().min(1, "Usuário é obrigatório."),
  type: z.enum(["ACCESS", "CORRECTION", "ANONYMIZATION", "PORTABILITY", "DELETION", "REVOCATION", "OPPOSITION", "OTHER"]),
  description: z.string().optional(),
  legalBasis: z.string().optional(),
});

const lgpdUpdateStatusSchema = z.object({
  requestId: z.string().min(1),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "REJECTED", "CANCELLED"]),
  rejectionReason: z.string().optional(),
  comment: z.string().optional(),
});

/**
 * LGPD — Direitos dos Titulares (Art. 18 LGPD)
 *
 * Permite que administradores autorizados (OWNER, ADMIN, MANAGER com audit.read)
 * criem e gerenciem solicitações de titulares:
 * - Acesso aos dados pessoais
 * - Correção de dados
 * - Anonimização/bloqueio/eliminação
 * - Portabilidade
 * - Eliminação
 * - Revogação do consentimento
 * - Oposição
 *
 * Cada solicitação fica vinculada à organização do solicitante,
 * impedindo acesso entre organizações.
 */

/**
 * Cria uma nova solicitação LGPD.
 * O titular pode solicitar sobre seus próprios dados;
 * admin pode solicitar em nome de outro titular da mesma organização.
 */
export async function createLGPDRequest(input: unknown) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const data = lgpdRequestSchema.parse(input);

    // Apenas OWNER, ADMIN, MANAGER podem criar solicitações para outros usuários
    // MEMBER só pode criar para si mesmo
    if (data.userId !== session.sub && !["OWNER", "ADMIN", "MANAGER"].includes(scope.role)) {
      throw new AppError("FORBIDDEN", "Você só pode criar solicitações para seus próprios dados.", 403);
    }

    // Se for admin criando para outro usuário, verificar se pertence à mesma organização
    if (data.userId !== session.sub) {
      const targetMembership = await prisma.organizationMember.findFirst({
        where: { userId: data.userId, organizationId: scope.orgId, status: "ATIVO" },
      });
      if (!targetMembership) {
        throw new AppError("NOT_FOUND", "Usuário não encontrado nesta organização.", 404);
      }
    }

    // Calcular prazo: 15 dias úteis (LGPD Art. 19, §1º)
    const responseDeadline = new Date();
    responseDeadline.setDate(responseDeadline.getDate() + 15);

    const request = await prisma.lGPDRequest.create({
      data: {
        organizationId: scope.orgId,
        userId: data.userId,
        requesterId: session.sub,
        type: data.type,
        description: data.description,
        legalBasis: data.legalBasis,
        responseDeadline,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        requester: { select: { id: true, name: true, email: true } },
      },
    });

    await logActivity({
      action: "lgpd.request.created",
      entity: "lgpd_request",
      entityId: request.id,
      newData: { type: data.type, userId: data.userId },
    });

    return ok({ request });
  });
}

/**
 * Lista solicitações LGPD da organização.
 * Respeita o Data Scope: MEMBER só vê suas próprias solicitações;
 * OWNER/ADMIN/MANAGER veem todas da organização.
 */
export async function listLGPDRequests() {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const where = scope.level === "ORG"
      ? { organizationId: scope.orgId }
      : { organizationId: scope.orgId, userId: session.sub };

    const requests = await prisma.lGPDRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        requester: { select: { id: true, name: true, email: true } },
        handledBy: { select: { id: true, name: true, email: true } },
        history: {
          orderBy: { changedAt: "desc" },
          take: 5,
          include: { changedBy: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok({ requests });
  });
}

/**
 * Atualiza o status de uma solicitação LGPD.
 * Apenas OWNER, ADMIN, MANAGER com permissão audit.read podem atualizar.
 */
export async function updateLGPDRequestStatus(input: unknown) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const data = lgpdUpdateStatusSchema.parse(input);

    // Apenas administradores podem atualizar status
    if (!["OWNER", "ADMIN", "MANAGER"].includes(scope.role)) {
      throw new AppError("FORBIDDEN", "Apenas administradores podem atualizar solicitações LGPD.", 403);
    }

    const request = await prisma.lGPDRequest.findFirst({
      where: { id: data.requestId, organizationId: scope.orgId },
      include: { history: { orderBy: { changedAt: "desc" }, take: 1 } },
    });
    if (!request) {
      throw new AppError("NOT_FOUND", "Solicitação não encontrada.", 404);
    }

    const now = new Date();
    const updateData: {
      status: typeof data.status;
      handledById?: string;
      handledAt?: Date;
      completedAt?: Date;
      rejectionReason?: string | null;
    } = {
      status: data.status,
      handledById: session.sub,
      handledAt: now,
    };

    if (data.status === "COMPLETED") {
      updateData.completedAt = now;
    }
    if (data.status === "REJECTED") {
      updateData.rejectionReason = data.rejectionReason ?? null;
    }

    const updated = await prisma.lGPDRequest.update({
      where: { id: data.requestId },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true } },
        handledBy: { select: { id: true, name: true, email: true } },
      },
    });

    // Registra no histórico
    await prisma.lGPDRequestHistory.create({
      data: {
        requestId: data.requestId,
        status: data.status,
        changedById: session.sub,
        comment: data.rejectionReason || undefined,
      },
    });

    await logActivity({
      action: "lgpd.request.updated",
      entity: "lgpd_request",
      entityId: data.requestId,
      newData: { status: data.status, rejectionReason: data.rejectionReason },
    });

    return ok({ request: updated });
  });
}

/**
 * Obtém detalhes de uma solicitação LGPD específica.
 */
export async function getLGPDRequest(requestId: string) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const where = scope.level === "ORG"
      ? { id: requestId, organizationId: scope.orgId }
      : { id: requestId, organizationId: scope.orgId, userId: session.sub };

    const request = await prisma.lGPDRequest.findFirst({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        requester: { select: { id: true, name: true, email: true } },
        handledBy: { select: { id: true, name: true, email: true } },
        history: {
          orderBy: { changedAt: "desc" },
          include: { changedBy: { select: { id: true, name: true } } },
        },
      },
    });
    if (!request) {
      throw new AppError("NOT_FOUND", "Solicitação não encontrada.", 404);
    }

    return ok({ request });
  });
}

/**
 * Exporta os dados pessoais de um usuário (portabilidade - Art. 20 LGPD).
 * Retorna todos os dados do usuário na organização em formato JSON.
 */
export async function exportUserData(userId: string) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    // Apenas o próprio usuário ou admin pode exportar
    if (userId !== session.sub && !["OWNER", "ADMIN", "MANAGER"].includes(scope.role)) {
      throw new AppError("FORBIDDEN", "Você só pode exportar seus próprios dados.", 403);
    }

    // Verificar se o usuário pertence à organização
    const membership = await prisma.organizationMember.findFirst({
      where: { userId, organizationId: scope.orgId },
    });
    if (!membership) {
      throw new AppError("NOT_FOUND", "Usuário não encontrado nesta organização.", 404);
    }

    // Coleta dados pessoais de várias tabelas
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, phone: true, avatarUrl: true,
        createdAt: true, updatedAt: true,
      },
    });

    const memberDetail = await prisma.organizationMember.findUnique({
      where: { id: membership.id },
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, jobTitle: true, user: { select: { name: true } } } },
        teamMembers: { include: { team: { select: { id: true, name: true } } } },
        projectMemberships: { select: { id: true, projectId: true } },
        tasksAsAssignee: { select: { id: true, taskId: true } },
        goalsAsLead: { select: { id: true, title: true, status: true } },
        goalMembers: { select: { id: true, goalId: true } },
      },
    });

    const sessions = await prisma.userSession.findMany({
      where: { userId },
      select: { id: true, ipAddress: true, userAgent: true, browser: true, device: true, os: true, createdAt: true, lastActiveAt: true, revokedAt: true },
    });

    const notifications = await prisma.notification.findMany({
      where: { userId, organizationId: scope.orgId },
      select: { id: true, type: true, title: true, message: true, readAt: true, createdAt: true },
    });

    const comments = await prisma.taskComment.findMany({
      where: { userId },
      select: { id: true, text: true, createdAt: true },
    });

    const activityLogs = await prisma.activityLog.findMany({
      where: { userId, organizationId: scope.orgId },
      select: { id: true, action: true, entity: true, entityId: true, createdAt: true },
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      organizationId: scope.orgId,
      user,
      membership: memberDetail,
      sessions,
      notifications,
      comments,
      activityLogs,
    };

    await logActivity({
      action: "lgpd.data.exported",
      entity: "user",
      entityId: userId,
      newData: { exportedAt: exportData.exportedAt, dataTypes: Object.keys(exportData) },
    });

    return ok({ data: exportData, userId, organizationId: scope.orgId });
  });
}

/**
 * Anonimiza os dados de um usuário (Art. 18, II LGPD).
 * Substitui dados identificadores por valores anonimizados.
 * Não exclui registros para manter integridade referencial.
 */
export async function anonymizeUserData(userId: string) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    // Apenas OWNER/ADMIN/MANAGER podem anonimizar
    if (!["OWNER", "ADMIN", "MANAGER"].includes(scope.role)) {
      throw new AppError("FORBIDDEN", "Apenas administradores podem anonimizar dados.", 403);
    }

    // Verificar se o usuário pertence à organização
    const membership = await prisma.organizationMember.findFirst({
      where: { userId, organizationId: scope.orgId },
    });
    if (!membership) {
      throw new AppError("NOT_FOUND", "Usuário não encontrado nesta organização.", 404);
    }

    const timestamp = Date.now();
    const anonSuffix = `anon_${timestamp}`;

    await prisma.$transaction([
      // Anonimizar usuário
      prisma.user.update({
        where: { id: userId },
        data: {
          name: `Usuário Anônimo ${anonSuffix}`,
          email: `anon_${timestamp}@anon.teamflow.local`,
          phone: null,
          avatarUrl: null,
          // passwordHash mantido para integridade, mas não é mais usado
        },
      }),
      // Anonimizar membership
      prisma.organizationMember.update({
        where: { id: membership.id },
        data: {
          jobTitle: null,
          cpf: null,
          phone: null,
          departmentId: null,
          managerId: null,
        },
      }),
      // Anonimizar comentários (mantém texto, remove vínculo direto)
      prisma.taskComment.updateMany({
        where: { userId },
        data: { userId: null },
      }),
      // Anonimizar notificações
      prisma.notification.updateMany({
        where: { userId },
        data: { userId: `anon_${timestamp}` }, // userId continua como referência, mas não identifica
      }),
    ]);

    await logActivity({
      action: "lgpd.data.anonymized",
      entity: "user",
      entityId: userId,
      newData: { anonymizedAt: new Date().toISOString(), suffix: anonSuffix },
    });

    return ok({ userId, anonymizedAt: new Date() });
  });
}

/**
 * Exclui dados de um usuário quando juridicamente cabível.
 * Só pode ser feito se não houver impedimento legal (ex: última OWNER).
 */
export async function deleteUserData(userId: string) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    // Apenas OWNER pode excluir dados de outros usuários
    if (userId !== session.sub && scope.role !== "OWNER") {
      throw new AppError("FORBIDDEN", "Apenas proprietários podem excluir dados de outros usuários.", 403);
    }

    // Verificar se o usuário é última OWNER da organização
    if (scope.role === "OWNER") {
      const ownerCount = await prisma.organizationMember.count({
        where: { organizationId: scope.orgId, role: "OWNER", status: "ATIVO" },
      });
      const targetIsOwner = await prisma.organizationMember.findFirst({
        where: { userId, organizationId: scope.orgId, role: "OWNER" },
      });
      if (targetIsOwner && ownerCount <= 1) {
        throw new AppError("LAST_OWNER", "Não é possível excluir o último proprietário da organização.", 403);
      }
    }

    // Verificar se pertence à organização
    const membership = await prisma.organizationMember.findFirst({
      where: { userId, organizationId: scope.orgId },
    });
    if (!membership) {
      throw new AppError("NOT_FOUND", "Usuário não encontrado nesta organização.", 404);
    }

    await prisma.$transaction([
      // Excluir sessões
      prisma.userSession.deleteMany({ where: { userId } }),
      // Excluir preferências
      prisma.userPreference.deleteMany({ where: { userId } }),
      // Excluir 2FA
      prisma.userTwoFactor.deleteMany({ where: { userId } }),
      // Excluir tokens de conta
      prisma.accountToken.deleteMany({ where: { userId } }),
      // Excluir consents
      prisma.consent.deleteMany({ where: { userId } }),
      // Excluir notificações
      prisma.notification.deleteMany({ where: { userId } }),
      // Excluir comentários
      prisma.taskComment.deleteMany({ where: { userId } }),
      // Excluir activity logs
      prisma.activityLog.deleteMany({ where: { userId } }),
      // Excluir participantes de evento
      prisma.eventParticipant.deleteMany({ where: { userId } }),
      // Excluir membership
      prisma.organizationMember.delete({ where: { id: membership.id } }),
      // Excluir usuário
      prisma.user.delete({ where: { id: userId } }),
    ]);

    await logActivity({
      action: "lgpd.data.deleted",
      entity: "user",
      entityId: userId,
      newData: { deletedAt: new Date().toISOString(), organizationId: scope.orgId },
    });

    return ok({ userId, deletedAt: new Date() });
  });
}
