"use server";

import { prisma } from "@/lib/prisma";
import { handleAction, AppError, ok } from "@/lib/errors";
import { requireSessionApi } from "@/lib/auth";
import { requireDataScope } from "@/server/scope";
import { logActivity } from "@/server/activity";
import z from "zod";

const integrationSchema = z.object({
  provider: z.string().min(1, "Informe o provedor.").max(100),
  config: z.record(z.string(), z.string()).optional().default({}),
  enabled: z.boolean().default(false),
});

export async function listIntegrations() {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const integrations = await prisma.integration.findMany({
      where: { organizationId: scope.orgId },
      include: {
        createdBy: { select: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok({ integrations });
  });
}

export async function createIntegration(input: unknown) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const data = integrationSchema.parse(input);

    const exists = await prisma.integration.findUnique({
      where: { organizationId_provider: { organizationId: scope.orgId, provider: data.provider } },
    });
    if (exists) {
      throw new AppError("EXISTS", "Integração já existe para este provedor.", 409);
    }

    const integration = await prisma.integration.create({
      data: {
        organizationId: scope.orgId,
        provider: data.provider,
        config: data.config,
        enabled: data.enabled,
        createdById: session.sub,
      },
      include: {
        createdBy: { select: { user: { select: { name: true } } } },
      },
    });

    await logActivity({
      action: "integration.created",
      entity: "integration",
      entityId: integration.id,
      newData: { provider: data.provider, enabled: data.enabled },
    });

    return ok({ integration });
  });
}

export async function updateIntegration(input: { id: string } & Record<string, unknown>) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const data = integrationSchema.parse(input);

    const integration = await prisma.integration.findFirst({
      where: { id: input.id, organizationId: scope.orgId },
    });
    if (!integration) {
      throw new AppError("NOT_FOUND", "Integração não encontrada.", 404);
    }

    const updated = await prisma.integration.update({
      where: { id: input.id },
      data: {
        config: data.config,
        enabled: data.enabled,
      },
      include: {
        createdBy: { select: { user: { select: { name: true } } } },
      },
    });

    await logActivity({
      action: "integration.updated",
      entity: "integration",
      entityId: input.id,
      newData: { provider: integration.provider, enabled: data.enabled },
    });

    return ok({ integration: updated });
  });
}

export async function deleteIntegration(id: string) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const integration = await prisma.integration.findFirst({
      where: { id, organizationId: scope.orgId },
    });
    if (!integration) {
      throw new AppError("NOT_FOUND", "Integração não encontrada.", 404);
    }

    await prisma.integration.delete({ where: { id } });

    await logActivity({
      action: "integration.deleted",
      entity: "integration",
      entityId: id,
      newData: { provider: integration.provider },
    });

    return ok({});
  });
}

export async function toggleIntegration(id: string) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const integration = await prisma.integration.findFirst({
      where: { id, organizationId: scope.orgId },
      select: { id: true, provider: true, enabled: true },
    });
    if (!integration) {
      throw new AppError("NOT_FOUND", "Integração não encontrada.", 404);
    }

    const updated = await prisma.integration.update({
      where: { id },
      data: { enabled: !integration.enabled },
    });

    await logActivity({
      action: "integration.toggled",
      entity: "integration",
      entityId: id,
      newData: { provider: integration.provider, enabled: !integration.enabled },
    });

    return ok({ integration: updated });
  });
}
