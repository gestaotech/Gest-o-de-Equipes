export const RETENTION_ENTITY_TYPES = ["activity_logs", "notifications"] as const;
export type RetentionEntityType = (typeof RETENTION_ENTITY_TYPES)[number];

export const RETENTION_ACTIONS = ["DELETE"] as const;

export const MIN_RETENTION_DAYS = 30;

export function isExecutableRetentionPolicy(policy: {
  entityType: string;
  action: string;
  retentionDays: number;
  isActive: boolean;
}): boolean {
  return (
    policy.isActive &&
    (RETENTION_ENTITY_TYPES as readonly string[]).includes(policy.entityType) &&
    (RETENTION_ACTIONS as readonly string[]).includes(policy.action) &&
    Number.isInteger(policy.retentionDays) &&
    policy.retentionDays >= MIN_RETENTION_DAYS
  );
}

export function retentionCutoff(retentionDays: number, now: Date): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}
