"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSession, requireSessionApi } from "@/lib/auth";
import { handleAction, AppError, ok } from "@/lib/errors";
import { orgSchema, onboardingSchema } from "@/lib/validations";
import { ensureCatalogs } from "@/lib/catalog";
import { slugify } from "@/lib/utils";
import { logActivity } from "@/server/activity";
import type { Prisma } from "@prisma/client";

async function uniqueSlug(base: string): Promise<string> {
  const clean = slugify(base).slice(0, 40) || "empresa";
  let slug = clean;
  for (let i = 0; i < 20; i++) {
    const exists = await prisma.organization.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${clean}-${Math.random().toString(36).slice(2, 6)}`;
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
      return created;
    });

    await ensureCatalogs();
    const starter = await prisma.plan.findUnique({
      where: { tier: "STARTER" },
    });
    if (starter) {
      await prisma.subscription.create({
        data: {
          organizationId: org.id,
          planId: starter.id,
          status: "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
        },
      });
    }

    await logActivity(org.id, session.sub, "organization.created", "organization", org.id, {
      name: org.name,
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
    const session = await requireSessionApi();
    const data = onboardingSchema.parse(input as Record<string, unknown>);
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.sub, organizationId: session.orgId },
      include: { organization: true },
    });
    if (!membership) {
      throw new AppError("NO_ORG", "Você ainda não possui uma organização.", 404);
    }
    const org = membership.organization;

    await prisma.organization.update({
      where: { id: org.id },
      data: {
        name: data.companyName?.trim() || org.name,
        segment: data.segment || org.segment,
        size: data.size || org.size,
      },
    });

    if (data.teamName) {
      await prisma.team.create({
        data: {
          organizationId: org.id,
          name: data.teamName.trim(),
          leadId: membership.id,
        },
      });
    }

    let projectId: string | null = null;
    if (data.projectName) {
      const project = await prisma.project.create({
        data: {
          organizationId: org.id,
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
          organizationId: org.id,
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

    await logActivity(org.id, session.sub, "onboarding.completed", "organization", org.id, {
      goal: data.goal || null,
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

export async function updateOrganizationInfo(input: {
  name?: string;
  segment?: string | null;
  size?: string | null;
}) {
  return handleAction(async () => {
    const session = await requireSessionApi();
    if (!session.orgId) throw new AppError("NO_ORG", "Sem organização.", 404);
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.sub, organizationId: session.orgId },
    });
    if (!membership) throw new AppError("FORBIDDEN", "Acesso negado.", 403);
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      throw new AppError("FORBIDDEN", "Sem permissão para editar a organização.", 403);
    }
    const data: Prisma.OrganizationUpdateInput = {};
    if (input.name?.trim()) data.name = input.name.trim();
    if (input.segment !== undefined) data.segment = input.segment;
    if (input.size !== undefined) data.size = input.size;
    const org = await prisma.organization.update({
      where: { id: session.orgId },
      data,
    });
    await logActivity(org.id, session.sub, "organization.updated", "organization", org.id, {
      name: org.name,
    });
    return { id: org.id, name: org.name };
  });
}