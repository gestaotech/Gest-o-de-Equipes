import "server-only";
import { prisma } from "@/lib/prisma";
import { isExecutableRetentionPolicy, retentionCutoff } from "@/lib/retention";

export type RetentionRunResult = {
  organizationId: string;
  policyId: string;
  entityType: string;
  deleted: number;
};

export async function runRetentionPolicies(now: Date = new Date()): Promise<RetentionRunResult[]> {
  const policies = await prisma.retentionPolicy.findMany({ where: { isActive: true } });
  const results: RetentionRunResult[] = [];

  for (const policy of policies) {
    if (!isExecutableRetentionPolicy(policy)) continue;

    const cutoff = retentionCutoff(policy.retentionDays, now);
    let deleted = 0;

    if (policy.entityType === "activity_logs") {
      const r = await prisma.activityLog.deleteMany({
        where: { organizationId: policy.organizationId, createdAt: { lt: cutoff } },
      });
      deleted = r.count;
    } else if (policy.entityType === "notifications") {
      const r = await prisma.notification.deleteMany({
        where: { organizationId: policy.organizationId, readAt: { lt: cutoff } },
      });
      deleted = r.count;
    }

    await prisma.activityLog.create({
      data: {
        organizationId: policy.organizationId,
        action: "governance.retention.executed",
        entity: "retention_policy",
        entityId: policy.id,
        newData: { entityType: policy.entityType, retentionDays: policy.retentionDays, deleted },
      },
    });

    results.push({
      organizationId: policy.organizationId,
      policyId: policy.id,
      entityType: policy.entityType,
      deleted,
    });
  }

  return results;
}
