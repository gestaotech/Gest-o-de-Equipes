/**
 * Papéis e status — módulo SEM dependência de Prisma.
 *
 * Client Components importam daqui para que `@prisma/client` nunca entre no
 * bundle do navegador, mesmo que alguém use `import { ... }` (valor) por engano.
 * `rbac.ts` reexporta para manter os imports existentes funcionando.
 */

export const ROLES = ["OWNER", "ADMIN", "MANAGER", "LEADER", "MEMBER"] as const;
export type RoleName = (typeof ROLES)[number];

export const MEMBER_STATUSES = ["ATIVO", "INATIVO"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

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

export const ROLE_OPTIONS: { value: RoleName; label: string }[] = ROLES.map((r) => ({
  value: r,
  label: ROLE_LABEL[r],
}));