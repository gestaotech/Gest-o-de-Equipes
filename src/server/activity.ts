import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { preferenceKeyForType } from "@/lib/user-preferences";

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
    // Respeita as preferências globais do usuário (in-system é o único canal).
    const key = preferenceKeyForType(type);
    if (key) {
      const pref = await prisma.userPreference.findUnique({
        where: { userId },
        select: { [key]: true },
      });
      if (pref && pref[key] === false) return;
    }
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