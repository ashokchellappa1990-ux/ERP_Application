import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Shared Audit Trail helper (Activity 5 of the platform roadmap).
 *
 * `writeAudit` appends exactly one row to `audit_logs`. It NEVER throws — a
 * logging failure must not roll back or block the business operation it records.
 *
 * Two modes:
 *  - Pass a transaction client (`tx`) to record the audit ATOMICALLY with the
 *    change: if the business txn rolls back, the audit row rolls back too (no
 *    orphan trail for an action that never happened).
 *  - Pass the default `prisma` client to log fire-and-forget AFTER a committed
 *    operation: the trail survives even if the business txn later failed.
 */

export type AuditActor = { id: number; tenantId: number; fullName?: string | null } | null | undefined;
type Db = Prisma.TransactionClient | typeof prisma;

export interface AuditInput {
  action: string; // dotted verb, e.g. "sales_return.create"
  entity: string; // model name, e.g. "SalesReturn"
  entityId?: string | number | null; // record PK (stringified)
  summary?: string | null; // human-readable one-liner
  meta?: unknown; // serialised to JSON (amounts, ids, before/after)
  businessId?: number | null; // active scope where the action happened
  branchId?: number | null;
  ip?: string | null;
}

export async function writeAudit(db: Db, user: AuditActor, input: AuditInput): Promise<void> {
  if (!user) return; // unauthenticated / system actions are not audited here
  try {
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        businessId: input.businessId ?? null,
        branchId: input.branchId ?? null,
        userId: user.id,
        userName: user.fullName ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId == null ? null : String(input.entityId),
        summary: input.summary ?? null,
        meta: input.meta === undefined ? null : JSON.stringify(input.meta),
        ip: input.ip ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] write failed:", input.action, err);
  }
}
