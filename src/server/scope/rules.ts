/**
 * Data Scope — regras puras de visibilidade por perfil.
 *
 * Este módulo NÃO acessa o banco. Ele recebe o contexto do usuário já
 * resolvido (sessão + membership da organização ATIVA) e devolve:
 *  - predicados puros  (`canSeeProject`, `canSeeTask`, ...)
 *  - filtros Prisma    (`projectVisibilityWhere`, `taskVisibilityWhere`, ...)
 *
 * Benefício: as regras de autorização ficam em UM lugar só (item 14 da fase)
 * e podem ser testadas sem mock de banco.
 *
 * Regra de ouro: `organizationId` sozinho NUNCA autoriza acesso a um recurso.
 */

import type { Prisma } from "@prisma/client";
import type { RoleName } from "@/lib/rbac";

// ------------------------------------------------------------
// CONTEXTO
// ------------------------------------------------------------

/**
 * ORG   → enxerga tudo da organização (OWNER, ADMIN, MANAGER)
 * LEAD  → escopo de liderança: o que lidera + do que participa (LEADER)
 * SELF  → escopo pessoal: apenas o que o próprio membro relaciona (MEMBER)
 */
export type ScopeLevel = "ORG" | "LEAD" | "SELF";

export type DataScope = {
  /** Organização ATIVA, derivada da sessão (nunca do frontend). */
  orgId: string;
  /** User.id da sessão. */
  userId: string;
  /** OrganizationMember.id do usuário na organização ativa. */
  memberId: string;
  role: RoleName;
  departmentId: string | null;
  level: ScopeLevel;
  /** Ids de equipes do usuário (carregado sob demanda). */
  teamIds?: string[];
  /** Ids de equipes lideradas pelo usuário (carregado sob demanda). */
  ledTeamIds?: string[];
};

const ORG_LEVEL_ROLES: readonly RoleName[] = ["OWNER", "ADMIN", "MANAGER"];

export function scopeLevelForRole(role: RoleName): ScopeLevel {
  if (ORG_LEVEL_ROLES.includes(role)) return "ORG";
  if (role === "LEADER") return "LEAD";
  return "SELF";
}

/** Constrói o Data Scope a partir do contexto já validado pela sessão. */
export function dataScopeFrom(input: {
  orgId: string;
  userId: string;
  memberId: string;
  role: RoleName;
  departmentId?: string | null;
}): DataScope {
  return {
    orgId: input.orgId,
    userId: input.userId,
    memberId: input.memberId,
    role: input.role,
    departmentId: input.departmentId ?? null,
    level: scopeLevelForRole(input.role),
  };
}

export const seesOrg = (s: DataScope) => s.level === "ORG";
export const isLead = (s: DataScope) => s.level === "LEAD";

const NEVER = "__tf_never_match__" as const;

// ------------------------------------------------------------
// FRAGMENTOS REUTILIZÁVEIS
// ------------------------------------------------------------

/** Projeto visível ao membro (responsável ou participante). */
const projectRel = (s: DataScope): Prisma.ProjectWhereInput[] => [
  { responsibleId: s.memberId },
  { members: { some: { memberId: s.memberId } } },
];

/** Equipe visível ao membro (liderada ou da qual participa). */
const teamRel = (s: DataScope): Prisma.TeamWhereInput[] =>
  isLead(s)
    ? [{ leadId: s.memberId }, { members: { some: { memberId: s.memberId } } }]
    : [{ members: { some: { memberId: s.memberId } } }];

const projectTeamLead = (s: DataScope): Prisma.ProjectWhereInput => ({
  team: { leadId: s.memberId },
});

// ------------------------------------------------------------
// FILTROS PARA LISTAGENS (Prisma where)
// ------------------------------------------------------------

/**
 * Projetos visíveis.
 * ORG: todos da org. LEAD: lidera a equipe ou participa. MEMBER: participa/responsável.
 */
export function projectVisibilityWhere(s: DataScope): Prisma.ProjectWhereInput {
  if (seesOrg(s)) return { organizationId: s.orgId };
  const rel: Prisma.ProjectWhereInput[] = projectRel(s);
  if (isLead(s)) rel.push(projectTeamLead(s));
  return { organizationId: s.orgId, OR: rel };
}

/**
 * Tarefas visíveis.
 * Nunca basta `organizationId`: exige atribuição, autoria ou relação com
 * projeto/equipe autorizada.
 */
export function taskVisibilityWhere(s: DataScope): Prisma.TaskWhereInput {
  if (seesOrg(s)) return { organizationId: s.orgId };
  const rel: Prisma.TaskWhereInput[] = [
    { assignees: { some: { memberId: s.memberId } } },
    { createdById: s.userId },
  ];
  if (isLead(s)) {
    rel.push(
      { team: { leadId: s.memberId } },
      { team: { members: { some: { memberId: s.memberId } } } },
      { project: { responsibleId: s.memberId } },
      { project: { members: { some: { memberId: s.memberId } } } },
      { project: { team: { leadId: s.memberId } } }
    );
  } else {
    rel.push(
      { team: { members: { some: { memberId: s.memberId } } } },
      { project: { responsibleId: s.memberId } },
      { project: { members: { some: { memberId: s.memberId } } } }
    );
  }
  return { organizationId: s.orgId, OR: rel };
}

/** Equipes visíveis. MEMBER só vê equipes das quais participa. */
export function teamVisibilityWhere(s: DataScope): Prisma.TeamWhereInput {
  if (seesOrg(s)) return { organizationId: s.orgId };
  return { organizationId: s.orgId, OR: teamRel(s) };
}

/** Departamentos visíveis. MEMBER só vê o próprio departamento. */
export function departmentVisibilityWhere(s: DataScope): Prisma.DepartmentWhereInput {
  if (seesOrg(s)) return { organizationId: s.orgId };
  if (isLead(s)) {
    return {
      organizationId: s.orgId,
      OR: [
        { members: { some: { id: s.memberId } } },
        { teams: { some: { leadId: s.memberId } } },
      ],
    };
  }
  // OrganizationMember é a própria Entidade do departamento: o filtro é pelo id do membro.
  return { organizationId: s.orgId, members: { some: { id: s.memberId } } };
}

/**
 * Eventos visíveis, respeitando o modelo ATUAL (sem EventParticipant — Fase 4).
 * Relações existentes: userId, teamId, projectId, taskId.
 * Quando `EventParticipant` existir, este filtro é o ponto único a estender.
 */
export function eventVisibilityWhere(s: DataScope): Prisma.EventWhereInput {
  if (seesOrg(s)) return { organizationId: s.orgId };
  const rel: Prisma.EventWhereInput[] = [{ userId: s.userId }];
  if (isLead(s)) {
    rel.push(
      { team: { leadId: s.memberId } },
      { team: { members: { some: { memberId: s.memberId } } } },
      { project: { responsibleId: s.memberId } },
      { project: { members: { some: { memberId: s.memberId } } } },
      { project: { team: { leadId: s.memberId } } },
      { task: { assignees: { some: { memberId: s.memberId } } } },
      { task: { createdById: s.userId } },
      { task: { team: { members: { some: { memberId: s.memberId } } } } }
    );
  } else {
    rel.push(
      { team: { members: { some: { memberId: s.memberId } } } },
      { project: { responsibleId: s.memberId } },
      { project: { members: { some: { memberId: s.memberId } } } },
      { task: { assignees: { some: { memberId: s.memberId } } } },
      { task: { createdById: s.userId } },
      { task: { team: { members: { some: { memberId: s.memberId } } } } }
    );
  }
  return { organizationId: s.orgId, OR: rel };
}

/** Metas visíveis. MEMBER só vê metas das quais é responsável ou membro. */
export function goalVisibilityWhere(s: DataScope): Prisma.GoalWhereInput {
  if (seesOrg(s)) return { organizationId: s.orgId };
  const rel: Prisma.GoalWhereInput[] = [
    { responsibleId: s.memberId },
    { members: { some: { memberId: s.memberId } } },
  ];
  if (isLead(s)) {
    rel.push(
      { team: { leadId: s.memberId } },
      { team: { members: { some: { memberId: s.memberId } } } }
    );
  }
  return { organizationId: s.orgId, OR: rel };
}

/**
 * Avisos visíveis conforme a AUDIÊNCIA já existente no modelo
 * (audience: company | department | team | user).
 */
export function announcementVisibilityWhere(s: DataScope): Prisma.AnnouncementWhereInput {
  if (seesOrg(s)) return { organizationId: s.orgId };
  const teamIds = s.teamIds?.length
    ? s.teamIds
    : s.ledTeamIds?.length
      ? s.ledTeamIds
      : [NEVER];
  return {
    organizationId: s.orgId,
    OR: [
      { audience: "company" },
      { audience: "user", audienceId: s.userId },
      { audience: "department", audienceId: s.departmentId ?? NEVER },
      { audience: "team", audienceId: { in: teamIds } },
    ],
  };
}

/** Atividades visíveis. MEMBER não enxerga o ActivityLog inteiro da org. */
export function activityVisibilityWhere(s: DataScope): Prisma.ActivityLogWhereInput {
  if (seesOrg(s)) return { organizationId: s.orgId };
  const rel: Prisma.ActivityLogWhereInput[] = [{ userId: s.userId }];
  if (isLead(s)) {
    rel.push(
      { project: { responsibleId: s.memberId } },
      { project: { members: { some: { memberId: s.memberId } } } },
      { project: { team: { leadId: s.memberId } } },
      { task: { assignees: { some: { memberId: s.memberId } } } },
      { task: { createdById: s.userId } },
      { task: { team: { leadId: s.memberId } } },
      { goal: { responsibleId: s.memberId } },
      { goal: { members: { some: { memberId: s.memberId } } } }
    );
  } else {
    rel.push(
      { project: { responsibleId: s.memberId } },
      { project: { members: { some: { memberId: s.memberId } } } },
      { task: { assignees: { some: { memberId: s.memberId } } } },
      { task: { createdById: s.userId } },
      { goal: { responsibleId: s.memberId } },
      { goal: { members: { some: { memberId: s.memberId } } } }
    );
  }
  return { organizationId: s.orgId, OR: rel };
}

/** Membros visíveis: ORG vê todos; LEAD vê os membros das equipes que lidera; MEMBER só si. */
export function visibleMembersWhere(s: DataScope): Prisma.OrganizationMemberWhereInput {
  if (seesOrg(s)) return { organizationId: s.orgId };
  if (isLead(s)) {
    return {
      organizationId: s.orgId,
      teamMembers: { some: { team: { leadId: s.memberId } } },
    };
  }
  return { organizationId: s.orgId, id: s.memberId };
}

// ------------------------------------------------------------
// PREDICADOS PARA RECURSOS ÚNICOS (canAccess*)
// ------------------------------------------------------------

/** Recurso já carregado do banco, com as relações necessárias à decisão. */
export type ProjectScopeShape = {
  organizationId: string;
  teamId?: string | null;
  responsibleId?: string | null;
  teamLeadId?: string | null;
  memberIds?: readonly string[];
};

export function canSeeProject(s: DataScope, p: ProjectScopeShape): boolean {
  if (p.organizationId !== s.orgId) return false;
  if (seesOrg(s)) return true;
  if (p.responsibleId === s.memberId) return true;
  if (p.memberIds?.includes(s.memberId)) return true;
  if (isLead(s) && p.teamLeadId === s.memberId) return true;
  return false;
}

export type TaskScopeShape = {
  organizationId: string;
  projectId?: string | null;
  teamId?: string | null;
  createdById?: string | null;
  assigneeIds?: readonly string[];
  project?: ProjectScopeShape | null;
  teamLeadId?: string | null;
  teamMemberIds?: readonly string[];
};

export function canSeeTask(s: DataScope, t: TaskScopeShape): boolean {
  if (t.organizationId !== s.orgId) return false;
  if (seesOrg(s)) return true;
  if (t.assigneeIds?.includes(s.memberId)) return true;
  if (t.createdById === s.userId) return true;
  if (t.project && canSeeProject(s, t.project)) return true;
  // tarefa de uma equipe da qual o usuário participa
  if (t.teamMemberIds?.includes(s.memberId)) return true;
  if (isLead(s) && t.teamLeadId === s.memberId) return true;
  return false;
}

export type TeamScopeShape = {
  organizationId: string;
  leadId?: string | null;
  memberIds?: readonly string[];
};

export function canSeeTeam(s: DataScope, t: TeamScopeShape): boolean {
  if (t.organizationId !== s.orgId) return false;
  if (seesOrg(s)) return true;
  if (t.memberIds?.includes(s.memberId)) return true;
  if (isLead(s) && t.leadId === s.memberId) return true;
  return false;
}

export type DepartmentScopeShape = {
  organizationId: string;
  memberIds?: readonly string[];
  teamLeadIds?: readonly string[];
};

export function canSeeDepartment(s: DataScope, d: DepartmentScopeShape): boolean {
  if (d.organizationId !== s.orgId) return false;
  if (seesOrg(s)) return true;
  if (d.memberIds?.includes(s.memberId)) return true;
  if (isLead(s) && d.teamLeadIds?.includes(s.memberId)) return true;
  return false;
}

export type EventScopeShape = {
  organizationId: string;
  userId?: string | null;
  teamId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  project?: ProjectScopeShape | null;
  task?: TaskScopeShape | null;
  teamLeadId?: string | null;
  teamMemberIds?: readonly string[];
};

export function canSeeEvent(s: DataScope, e: EventScopeShape): boolean {
  if (e.organizationId !== s.orgId) return false;
  if (seesOrg(s)) return true;
  // evento pessoal
  if (e.userId === s.userId) return true;
  // evento da equipe do usuário
  if (e.teamId && s.teamIds?.includes(e.teamId)) return true;
  if (e.teamMemberIds?.includes(s.memberId)) return true;
  if (isLead(s) && e.teamLeadId === s.memberId) return true;
  // evento de projeto permitido
  if (e.project && canSeeProject(s, e.project)) return true;
  // evento de tarefa permitida
  if (e.task && canSeeTask(s, e.task)) return true;
  return false;
}

export type GoalScopeShape = {
  organizationId: string;
  responsibleId?: string | null;
  teamId?: string | null;
  memberIds?: readonly string[];
  teamLeadId?: string | null;
};

export function canSeeGoal(s: DataScope, g: GoalScopeShape): boolean {
  if (g.organizationId !== s.orgId) return false;
  if (seesOrg(s)) return true;
  if (g.responsibleId === s.memberId) return true;
  if (g.memberIds?.includes(s.memberId)) return true;
  if (isLead(s)) {
    if (g.teamLeadId === s.memberId) return true;
    if (g.teamId && s.teamIds?.includes(g.teamId)) return true;
  }
  return false;
}

export type AnnouncementScopeShape = {
  organizationId: string;
  audience: string;
  audienceId?: string | null;
};

export function canSeeAnnouncement(s: DataScope, a: AnnouncementScopeShape): boolean {
  if (a.organizationId !== s.orgId) return false;
  if (seesOrg(s)) return true;
  switch (a.audience) {
    case "company":
      return true;
    case "user":
      return a.audienceId === s.userId;
    case "department":
      return !!s.departmentId && a.audienceId === s.departmentId;
    case "team":
      return !!a.audienceId && !!s.teamIds?.includes(a.audienceId);
    default:
      // audiência desconhecida não é liberada (fail closed).
      return false;
  }
}

// ------------------------------------------------------------
// INDICADORES — PERMISSION vs SCOPE
// ------------------------------------------------------------

/**
 * PERMISSION: o usuário pode acessar o MÓDULO de indicadores?
 * (delega ao RBAC já existente — não duplica regra de papel)
 */
export function canAccessIndicatorsModule(permitsFn: (role: RoleName, perm: string) => boolean, role: RoleName): boolean {
  return permitsFn(role, "indicators.read");
}

/**
 * SCOPE: quais indicadores o usuário pode ver?
 * Para escopo não-ORG o filtro `memberId` é FORÇADO para o próprio membro,
 * ignorando qualquer `memberId` vindo do cliente (evita IDOR de relatório).
 */
export function indicatorScopeFor<T extends { memberId?: string }>(
  s: DataScope,
  requested: T
): T & { memberId: string } {
  if (seesOrg(s)) {
    return { ...requested, memberId: requested.memberId ?? s.memberId } as T & { memberId: string };
  }
  return { ...requested, memberId: s.memberId };
}