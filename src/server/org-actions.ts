"use server";

import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { createSession, requireSessionApi } from "@/lib/auth";
import { handleAction, AppError, ok } from "@/lib/errors";
import { orgSchema, onboardingSchema, orgUpdateSchema } from "@/lib/validations";
import { ensureCatalogs } from "@/lib/catalog";
import { slugify } from "@/lib/utils";
import { getContext, guardRole } from "@/server/guards";
import { logActivity } from "@/server/activity";

async function uniqueSlug(base: string): Promise<string> {
  const clean = slugify(base).slice(0, 40) || "empresa";
  let slug = clean;
  for (let i = 0; i < 20; i++) {
    const exists = await prisma.organization.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${clean}-${randomBytes(3).toString("hex")}`;
  }
  return `${clean}-${Date.now().toString(36)}`;
}

export async function createOrganization(input: unknown) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const data = orgSchema.parse(input);
    const slug = data.slug?.trim() || (await uniqueSlug(data.name));

    const org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: data.name.trim(),
          slug,
          segment: data.segment || null,
          size: data.size || null,
        },
      });
      await tx.organizationMember.create({
        data: {
          organizationId: created.id,
          userId: session.sub,
          role: "OWNER",
          jobTitle: "Fundador",
        },
      });
      // Assinatura criada na MESMA transação — org nunca fica sem plano.
      const starter = await tx.plan.findUnique({
        where: { tier: "STARTER" },
      });
      if (starter) {
        await tx.subscription.create({
          data: {
            organizationId: created.id,
            planId: starter.id,
            status: "ACTIVE",
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
          },
        });
      }
      return created;
    });

    await ensureCatalogs();

    await logActivity({
      action: "organization.created",
      entity: "organization",
      entityId: org.id,
      newData: {
        name: org.name,
      },
    });
    const store = await cookies();
    store.set("tf_org", org.id, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    await createSession({
      sub: session.sub,
      email: session.email,
      name: session.name,
      orgId: org.id,
    });
    return { id: org.id, slug: org.slug, name: org.name };
  });
}

export async function saveOnboarding(input: unknown) {
  return handleAction(async () => {
    const { orgId, session, membership } = await getContext();
    guardRole(membership, "OWNER");
    const data = onboardingSchema.parse(input as Record<string, unknown>);

    await prisma.organization.update({
      where: { id: orgId },
      data: {
        name: data.companyName?.trim() || undefined,
        segment: data.segment || undefined,
        size: data.size || undefined,
      },
    });

    if (data.teamName) {
      await prisma.team.create({
        data: {
          organizationId: orgId,
          name: data.teamName.trim(),
          leadId: membership.id,
        },
      });
    }

    let projectId: string | null = null;
    if (data.projectName) {
      const project = await prisma.project.create({
        data: {
          organizationId: orgId,
          name: data.projectName.trim(),
          status: "PLANEJAMENTO",
          priority: "MEDIUM",
          responsibleId: membership.id,
          createdById: session.sub,
        },
      });
      projectId = project.id;
    }

    if (data.taskTitle) {
      await prisma.task.create({
        data: {
          organizationId: orgId,
          title: data.taskTitle.trim(),
          projectId,
          createdById: session.sub,
          status: "TODO",
          priority: "MEDIUM",
          dueDate: data.taskDue ? new Date(data.taskDue) : null,
          assignees: {
            create: [{ memberId: membership.id }],
          },
        },
      });
    }

    await logActivity({
      action: "onboarding.completed",
      entity: "organization",
      entityId: orgId,
      newData: {
        goal: data.goal || null,
      },
    });
    return ok({});
  });
}

export async function switchOrganization(orgId: string) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.sub, organizationId: orgId },
    });
    if (!membership) {
      throw new AppError("FORBIDDEN", "Você não pertence a esta organização.", 403);
    }
    const store = await cookies();
    store.set("tf_org", orgId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return ok({});
  });
}

export async function updateOrganizationInfo(input: unknown) {
  return handleAction(async () => {
    const { orgId, membership } = await getContext();
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      throw new AppError("FORBIDDEN", "Sem permissão para editar a organização.", 403);
    }
    const data = orgUpdateSchema.parse(input);
    const org = await prisma.organization.update({
      where: { id: orgId },
      data: {
        name: data.name.trim(),
        segment: data.segment || null,
        size: data.size || null,
      },
    });
    await logActivity({
      action: "organization.updated",
      entity: "organization",
      entityId: org.id,
      newData: {
        name: org.name,
      },
    });
    return { id: org.id, name: org.name };
  });
}