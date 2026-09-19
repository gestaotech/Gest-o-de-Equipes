import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function logActivity(
  orgId: string,
  userId: string,
  action: string,
  entity: string,
  entityId?: string | null,
  newData?: Prisma.InputJsonValue
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        organizationId: orgId,
        userId,
        action,
        entity,
        entityId: entityId ?? null,
        newData: newData ?? Prisma.JsonNull,
      },
    });
  } catch (err) {
    console.error("[activity]", err);
  }
}

export async function notify(
  orgId: string,
  userId: string,
  type: string,
  title: string,
  message?: string
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        organizationId: orgId,
        userId,
        type,
        title,
        message,
      },
    });
  } catch (err) {
    console.error("[notify]", err);
  }
}