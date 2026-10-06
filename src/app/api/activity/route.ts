import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession, getActiveOrg } from "@/lib/auth";
import { permits } from "@/lib/rbac";
import {
  activityVisibilityWhere,
  dataScopeFrom,
  visibleMembersWhere,
} from "@/server/scope/rules";
import type { RoleName } from "@/lib/rbac";

const PAGE_SIZE = 20;
const DAY = 86400000;

function buildRange(
  period: string,
  from?: string,
  to?: string
): { gte: Date; lte: Date } | null {
  const now = new Date();
  switch (period) {
    case "today":
      return {
        gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        lte: now,
      };
    case "7d":
      return { gte: new Date(now.getTime() - 7 * DAY), lte: now };
    case "30d":
      return { gte: new Date(now.getTime() - 30 * DAY), lte: now };
    case "90d":
      return { gte: new Date(now.getTime() - 90 * DAY), lte: now };
    case "this_month":
      return { gte: new Date(now.getFullYear(), now.getMonth(), 1), lte: now };
    case "last_month": {
      return {
        gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        lte: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      };
    }
    case "this_year":
      return { gte: new Date(now.getFullYear(), 0, 1), lte: now };
    default: {
      if (period === "custom" && from && to) {
        const f = new Date(from);
        const t = new Date(to);
        if (!Number.isNaN(f.getTime()) && !Number.isNaN(t.getTime())) {
          t.setHours(23, 59, 59, 999);
          return { gte: f, lte: t };
        }
      }
      return null;
    }
  }
}

function maskIp(ip: string | null): string | null {
  if (!ip) return null;
  return ip
    .replace(/^::ffff:/, "")
    .replace(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.)\d{1,3}$/, "$1x")
    .replace(/^([0-9a-f:]+:)[0-9a-fx]+$/, "$1x");
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const org = await getActiveOrg(session);
  if (!org) {
    return NextResponse.json({ error: "Nenhuma organização ativa." }, { status: 403 });
  }
  if (!permits(org.role, "audit.read")) {
    return NextResponse.json({ error: "Sem permissão para ler auditoria." }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const rawPage = Number(sp.get("page"));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 0;
  const search = sp.get("search")?.trim() ?? "";
  const action = sp.get("action")?.trim() ?? "";
  const entity = sp.get("entity")?.trim() ?? "";
  const userId = sp.get("userId")?.trim() ?? "";
  const period = sp.get("period") ?? "";
  const isExport = sp.get("export") === "1";

  const range = buildRange(period, sp.get("from") ?? undefined, sp.get("to") ?? undefined);

  // Data Scope: o ActivityLog é filtrado pelo escopo do perfil (defesa em
  // profundidade, mesmo com `audit.read`). `organizationId` sozinho nunca
  // autoriza a leitura da auditoria inteira da organização.
  const scope = dataScopeFrom({
    orgId: org.id,
    userId: session.sub,
    memberId: org.membership.id,
    role: org.role as RoleName,
    departmentId: org.membership.departmentId,
  });

  const where: Prisma.ActivityLogWhereInput = activityVisibilityWhere(scope);
  if (range) where.createdAt = { gte: range.gte, lte: range.lte };
  if (action) where.action = action;
  if (entity) where.entity = entity;
  // O filtro de userId também respeita o escopo: um MEMBER não busca a
  // atividade de outra pessoa alterando o parâmetro.
  if (userId) where.userId = userId;
  if (search) {
    // A busca entra em `AND` para NUNCA sobrescrever o `OR` de visibilidade.
    where.AND = [
      {
        OR: [
          { action: { contains: search, mode: "insensitive" } },
          { entity: { contains: search, mode: "insensitive" } },
          { user: { name: { contains: search, mode: "insensitive" } } },
        ],
      },
    ];
  }

  try {
    const [countResult, items] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        ...(isExport ? {} : { skip: page * PAGE_SIZE, take: PAGE_SIZE }),
      }),
    ]);

    const enriched = items.map((log) => ({
      ...log,
      ipAddress: maskIp(log.ipAddress),
      createdAt: log.createdAt.toISOString(),
    }));

    // Lista de usuários para o filtro da tela.
    const memberships = await prisma.organizationMember.findMany({
      where: visibleMembersWhere(scope),
      select: { userId: true, user: { select: { name: true } } },
      orderBy: { joinedAt: "asc" },
    });
    const users = memberships.map((m) => ({ id: m.userId, name: m.user.name }));

    return NextResponse.json({
      items: enriched,
      total: isExport ? items.length : countResult,
      totalPages: isExport ? 1 : Math.max(1, Math.ceil(countResult / PAGE_SIZE)),
      page,
      users,
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar as atividades. Tente novamente." },
      { status: 500 }
    );
  }
}