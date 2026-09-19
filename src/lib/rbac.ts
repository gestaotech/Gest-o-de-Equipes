import type { RoleName } from "@prisma/client";

export const ROLE_ORDER: Record<RoleName, number> = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  LEADER: 2,
  MEMBER: 1,
};

export const ROLE_LABEL: Record<RoleName, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  LEADER: "Líder",
  MEMBER: "Membro",
};

/** true quando o papel possui nível >= mínimo */
export function hasRole(role: RoleName, min: RoleName): boolean {
  return ROLE_ORDER[role] >= ROLE_ORDER[min];
}

/** Coleções de permissões por papel (catálogo consultável) */
export function rolePermits(role: RoleName): string[] {
  if (role === "OWNER") return ["*"];
  const base = [
    "tasks.read",
    "projects.read",
    "teams.read",
    "departments.read",
    "users.read",
    "goals.read",
    "agenda.read",
    "announcements.read",
  ];
  if (role === "MEMBER") return base;
  if (role === "LEADER") return [
    ...base,
    "tasks.write",
  ];
  if (role === "MANAGER") return [
    ...base,
    "tasks.write",
    "tasks.delete",
    "projects.write",
    "projects.delete",
    "teams.write",
    "teams.delete",
    "departments.write",
    "users.write",
    "goals.write",
    "agenda.write",
    "announcements.write",
  ];
  // ADMIN
  return [
    ...base,
    "tasks.write",
    "tasks.delete",
    "projects.write",
    "projects.delete",
    "teams.write",
    "teams.delete",
    "departments.write",
    "departments.delete",
    "users.write",
    "users.delete",
    "goals.write",
    "goals.delete",
    "agenda.write",
    "announcements.write",
    "announcements.delete",
    "integrations.write",
    "settings.write",
    "billing.read",
  ];
}

export function permits(role: RoleName, permission: string): boolean {
  if (role === "OWNER") return true;
  return rolePermits(role).includes(permission);
}

export function permitsAny(role: RoleName, permissions: string[]): boolean {
  return permissions.some((p) => permits(role, p));
}