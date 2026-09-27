import "server-only";
import { prisma } from "@/lib/prisma";
import type { PlanTier, RoleName } from "@prisma/client";

/** Catálogo de papéis + permissões (RBAC) que são semeados por organização */
const ROLES: { name: RoleName; description: string }[] = [
  { name: "OWNER", description: "Acesso total à organização." },
  { name: "ADMIN", description: "Gerencia configurações, pessoas e dados." },
  { name: "MANAGER", description: "Gerencia departamentos, equipes, projetos e metas." },
  { name: "LEADER", description: "Lidera uma equipe e gerencia tarefas." },
  { name: "MEMBER", description: "Acesso a leitura e às suas tarefas." },
];

const PERMISSIONS = [
  "users.read",
  "users.write",
  "users.delete",
  "departments.read",
  "departments.write",
  "departments.delete",
  "teams.read",
  "teams.write",
  "teams.delete",
  "projects.read",
  "projects.write",
  "projects.delete",
  "tasks.read",
  "tasks.write",
  "tasks.delete",
  "goals.read",
  "goals.write",
  "goals.delete",
  "agenda.read",
  "agenda.write",
  "announcements.read",
  "announcements.write",
  "announcements.delete",
  "integrations.write",
  "settings.write",
  "billing.read",
  "indicators.read",
  "kpis.read",
  "reports.read",
  "reports.export",
  "kpis.create",
  "kpis.update",
  "kpis.delete",
  // Auditoria
  "audit.read",
  "audit.export",
];

const ROLE_MATRIX: Partial<Record<RoleName, string[]>> = {
  OWNER: ["*"],
  ADMIN: PERMISSIONS,
  MANAGER: [
    "users.read",
    "departments.read",
    "departments.write",
    "teams.read",
    "teams.write",
    "teams.delete",
    "projects.read",
    "projects.write",
    "projects.delete",
    "goals.read",
    "goals.write",
    "agenda.read",
    "agenda.write",
    "announcements.read",
    "announcements.write",
    "reports.read",
    "reports.export",
    "kpis.create",
    "kpis.update",
    "kpis.delete",
    // Auditoria - MANAGER pode ler auditoria
    "audit.read",
  ],
  LEADER: [
    "users.read",
    "departments.read",
    "teams.read",
    "projects.read",
    "tasks.read",
    "goals.read",
    "agenda.read",
    "announcements.read",
    "indicators.read",
    "kpis.read",
    "reports.read",
  ],
  MEMBER: [
    "users.read",
    "departments.read",
    "teams.read",
    "projects.read",
    "goals.read",
    "agenda.read",
    "announcements.read",
    "indicators.read",
    "kpis.read",
    "reports.read",
  ],
};

const PLANS: {
  tier: PlanTier;
  name: string;
  maxUsers: number | null;
  maxTeams: number | null;
  maxProjects: number | null;
  advancedReports: boolean;
  integrations: boolean;
  aiFeatures: boolean;
  priceMonthly: number;
  priceYearly: number;
}[] = [
  {
    tier: "STARTER",
    name: "Starter",
    maxUsers: 10,
    maxTeams: null,
    maxProjects: 10,
    advancedReports: false,
    integrations: false,
    aiFeatures: false,
    priceMonthly: 49.9,
    priceYearly: 499,
  },
  {
    tier: "PROFESSIONAL",
    name: "Professional",
    maxUsers: 50,
    maxTeams: 10,
    maxProjects: null,
    advancedReports: true,
    integrations: true,
    aiFeatures: false,
    priceMonthly: 99,
    priceYearly: 990,
  },
  {
    tier: "BUSINESS",
    name: "Business",
    maxUsers: null as number | null,
    maxTeams: null as number | null,
    maxProjects: null as number | null,
    advancedReports: true,
    integrations: true,
    aiFeatures: false,
    priceMonthly: 0,
    priceYearly: 0,
  },
];

export async function ensureCatalogs(): Promise<void> {
  const roles = new Map<
    string,
    { id: string }
  >();
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: r,
    });
    roles.set(r.name, role);
  }

  const permissionIds = new Map<string, string>();
  for (const p of PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { name: p },
      update: {},
      create: { name: p, description: null },
    });
    permissionIds.set(p, perm.id);
  }

  for (const roleName of ROLES.map((r) => r.name)) {
    const permNames = ROLE_MATRIX[roleName] as string[];
    const role = roles.get(roleName)!;
    const linked = permNames.includes("*")
      ? PERMISSIONS
      : permNames;
    for (const p of linked) {
      const pid = permissionIds.get(p);
      if (!pid) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: pid } },
        update: {},
        create: { roleId: role.id, permissionId: pid },
      });
    }
  }

  for (const p of PLANS) {
    await prisma.plan.upsert({
      where: { tier: p.tier },
      update: {
        name: p.name,
        maxUsers: p.maxUsers,
        maxTeams: p.maxTeams,
        maxProjects: p.maxProjects,
        advancedReports: p.advancedReports,
        integrations: p.integrations,
        aiFeatures: p.aiFeatures,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
      },
      create: p,
    });
  }
}