import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/** User ↔ terminal mapping helpers (mirrors setRolePermissions). */

type Db = Prisma.TransactionClient | typeof prisma;

/** The terminal ids a user is mapped to (empty = unmapped → sees all). */
export async function getUserTerminalIds(user: { id: number }): Promise<number[]> {
  const rows = await prisma.userTerminalMap.findMany({ where: { userId: user.id }, select: { terminalId: true } });
  return rows.map((r) => r.terminalId);
}

/** Replace a user's terminal mapping with `terminalIds` (validated against the
 *  tenant). Pass a tx to run inside a larger transaction. */
export async function setUserTerminals(
  db: Db,
  opts: { tenantId: number; userId: number; terminalIds: number[]; businessId?: number | null; branchId?: number | null; createdBy?: number | null },
): Promise<void> {
  const { tenantId, userId, terminalIds } = opts;
  // Only keep ids that actually belong to this tenant.
  const valid = terminalIds.length
    ? (await db.posTerminal.findMany({ where: { id: { in: terminalIds }, tenantId }, select: { id: true } })).map((t) => t.id)
    : [];
  await db.userTerminalMap.deleteMany({ where: { userId } });
  if (valid.length) {
    await db.userTerminalMap.createMany({
      data: valid.map((terminalId) => ({ tenantId, userId, terminalId, businessId: opts.businessId ?? null, branchId: opts.branchId ?? null, createdBy: opts.createdBy ?? null })),
      skipDuplicates: true,
    });
  }
}
