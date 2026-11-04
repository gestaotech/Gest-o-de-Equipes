"use server";

import { prisma } from "@/lib/prisma";
import { handleAction, AppError, ok } from "@/lib/errors";
import { requireSessionApi } from "@/lib/auth";
import { requireDataScope } from "@/server/scope";
import { logActivity } from "@/server/activity";

export async function joinEvent(input: { eventId: string }) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const { eventId } = input;

    // Verificar se o evento existe e pertence à organização
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizationId: true, userId: true },
    });
    if (!event || event.organizationId !== scope.orgId) {
      throw new AppError("NOT_FOUND", "Evento não encontrado.", 404);
    }

    // Não permitir participar do próprio evento como participante (o criador já é o owner)
    if (event.userId === session.sub) {
      throw new AppError("BAD_REQUEST", "O criador do evento já é o responsável.", 400);
    }

    // Verificar se já é participante
    const existing = await prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId, userId: session.sub } },
    });
    if (existing) {
      throw new AppError("EXISTS", "Você já é participante deste evento.", 409);
    }

    const participant = await prisma.eventParticipant.create({
      data: {
        eventId,
        userId: session.sub,
        status: "PENDING",
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await logActivity({
      action: "event.joined",
      entity: "event",
      entityId: eventId,
      newData: { eventId, status: "PENDING" },
    });

    return ok({ participant });
  });
}

export async function leaveEvent(input: { eventId: string }) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const { eventId } = input;

    const participant = await prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId, userId: session.sub } },
      select: { id: true, eventId: true, userId: true },
    });
    if (!participant) {
      throw new AppError("NOT_FOUND", "Participação não encontrada.", 404);
    }

    // Verificar se o evento pertence à organização do usuário
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizationId: true },
    });
    if (!event || event.organizationId !== scope.orgId) {
      throw new AppError("NOT_FOUND", "Evento não encontrado.", 404);
    }

    await prisma.eventParticipant.delete({
      where: { id: participant.id },
    });

    await logActivity({
      action: "event.left",
      entity: "event",
      entityId: eventId,
      newData: { eventId },
    });

    return ok({});
  });
}

export async function updateParticipantStatus(input: {
  eventId: string;
  userId: string;
  status: "PENDING" | "CONFIRMED" | "DECLINED";
}) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const { eventId, userId, status } = input;

    // Apenas o criador do evento ou admin da org pode alterar status
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizationId: true, userId: true },
    });
    if (!event || event.organizationId !== scope.orgId) {
      throw new AppError("NOT_FOUND", "Evento não encontrado.", 404);
    }

    const isCreator = event.userId === session.sub;
    const isOrgAdmin = ["OWNER", "ADMIN", "MANAGER"].includes(scope.role);
    if (!isCreator && !isOrgAdmin) {
      throw new AppError("FORBIDDEN", "Você não pode alterar o status deste participante.", 403);
    }

    const participant = await prisma.eventParticipant.update({
      where: { eventId_userId: { eventId, userId } },
      data: {
        status,
        respondedAt: status !== "PENDING" ? new Date() : null,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await logActivity({
      action: "event.participant.updated",
      entity: "event",
      entityId: eventId,
      newData: { eventId, participantUserId: userId, status },
    });

    return ok({ participant });
  });
}

export async function getEventParticipants(input: { eventId: string }) {
  return handleAction(async () => {
    const scope = await requireDataScope();
    const { eventId } = input;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizationId: true },
    });
    if (!event || event.organizationId !== scope.orgId) {
      throw new AppError("NOT_FOUND", "Evento não encontrado.", 404);
    }

    const participants = await prisma.eventParticipant.findMany({
      where: { eventId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return ok({ participants });
  });
}

export async function getMyEventParticipations() {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const participations = await prisma.eventParticipant.findMany({
      where: { userId: session.sub },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
            organizationId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Filtrar apenas eventos da organização ativa
    const filtered = participations.filter((p) => p.event.organizationId === scope.orgId);

    return ok({ participations: filtered });
  });
}
