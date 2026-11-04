"use server";

import { prisma } from "@/lib/prisma";
import { handleAction, AppError, ok } from "@/lib/errors";
import { requireSessionApi } from "@/lib/auth";
import { requireDataScope } from "@/server/scope";
import { logActivity } from "@/server/activity";

export async function getNotifications() {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const notifications = await prisma.notification.findMany({
      where: {
        organizationId: scope.orgId,
        userId: session.sub,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        organizationId: scope.orgId,
        userId: session.sub,
        readAt: null,
      },
    });

    return ok({ notifications, unreadCount });
  });
}

export async function markNotificationAsRead(input: { notificationId: string }) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const { notificationId } = input;

    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        organizationId: scope.orgId,
        userId: session.sub,
      },
    });
    if (!notification) {
      throw new AppError("NOT_FOUND", "Notificação não encontrada.", 404);
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    return ok({});
  });
}

export async function markAllNotificationsAsRead() {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    await prisma.notification.updateMany({
      where: {
        organizationId: scope.orgId,
        userId: session.sub,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return ok({});
  });
}

export async function deleteNotification(input: { notificationId: string }) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const { notificationId } = input;

    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        organizationId: scope.orgId,
        userId: session.sub,
      },
    });
    if (!notification) {
      throw new AppError("NOT_FOUND", "Notificação não encontrada.", 404);
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    return ok({});
  });
}

export async function getUnreadCount() {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const count = await prisma.notification.count({
      where: {
        organizationId: scope.orgId,
        userId: session.sub,
        readAt: null,
      },
    });

    return ok({ unreadCount: count });
  });
}

/**
 * Função auxiliar para criar notificações (usada internamente por outras actions)
 */
export async function createNotification(data: {
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  message?: string;
}) {
  return prisma.notification.create({
    data: {
      organizationId: data.organizationId,
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
    },
  });
}
