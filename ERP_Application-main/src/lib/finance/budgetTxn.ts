import type { Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db/prisma";
import type { BudgetLogEntry, TxnStatus } from "@/lib/contracts/budgetTxn";

const num = (v: unknown) => (v == null ? 0 : Number(v));
type Db = Prisma.TransactionClient | typeof defaultPrisma;

/** Resolve user ids → display names (fullName → username → email → #id). */
export async function resolveUsers(db: Db, ids: (number | null | undefined)[]): Promise<Map<number, string>> {
  const uniq = [...new Set(ids.filter((x): x is number => !!x))];
  if (!uniq.length) return new Map();
  const users = await db.user.findMany({ where: { id: { in: uniq } }, select: { id: true, fullName: true, username: true, email: true } });
  return new Map(users.map((u) => [u.id, u.fullName || u.username || u.email || `#${u.id}`]));
}
export const nameOf = (m: Map<number, string>, id: number | null | undefined) => (id ? m.get(id) ?? `#${id}` : null);

/**
 * Budget Log / Timeline for a plan (optionally one head) — derived read-only from
 * the plan + revision + transfer records using their STORED snapshots (nothing is
 * recomputed, so history is immutable). Chronological.
 */
export async function buildBudgetLog(db: Db, headerId: number, headId?: number): Promise<BudgetLogEntry[]> {
  const header = await db.budgetHeader.findFirst({ where: { id: headerId }, include: { lines: true } });
  if (!header) return [];
  const [revs, trs] = await Promise.all([
    db.budgetRevision.findMany({ where: { headerId, ...(headId ? { headId } : {}) }, orderBy: [{ revisionDate: "asc" }, { id: "asc" }] }),
    db.budgetTransfer.findMany({ where: { headerId, ...(headId ? { OR: [{ fromHeadId: headId }, { toHeadId: headId }] } : {}) }, orderBy: [{ transferDate: "asc" }, { id: "asc" }] }),
  ]);
  const users = await resolveUsers(db, [header.createdBy, ...revs.flatMap((r) => [r.requestedBy, r.approvedBy]), ...trs.flatMap((t) => [t.requestedBy, t.approvedBy])]);

  const lines = headId ? header.lines.filter((l) => l.headId === headId) : header.lines;
  const created = header.createdAt.toISOString().slice(0, 10);
  const entries: BudgetLogEntry[] = [];

  for (const l of lines) entries.push({
    date: created, type: "Budget Planning", refNo: `PLAN-${header.id}`, headName: l.headName ?? "",
    previousBudget: 0, amount: num(l.annual), currentBudget: num(l.annual),
    createdByName: nameOf(users, header.createdBy), approvedByName: null, status: "—", remarks: `Plan ${header.status}`,
  });
  for (const r of revs) entries.push({
    date: r.revisionDate, type: r.revisionType === "increase" ? "Revision (Increase)" : "Revision (Decrease)", refNo: r.revisionNo, headName: r.headName ?? "",
    previousBudget: num(r.previousBudget), amount: (r.revisionType === "increase" ? 1 : -1) * num(r.amount), currentBudget: num(r.revisedBudget),
    createdByName: nameOf(users, r.requestedBy), approvedByName: nameOf(users, r.approvedBy), status: r.status as TxnStatus, remarks: r.remarks ?? r.reason ?? null,
  });
  for (const t of trs) {
    if (!headId || t.fromHeadId === headId) entries.push({
      date: t.transferDate, type: "Transfer Out", refNo: t.transferNo, headName: t.fromHeadName ?? "",
      previousBudget: num(t.fromPrevBudget), amount: -num(t.amount), currentBudget: num(t.fromNewBudget),
      createdByName: nameOf(users, t.requestedBy), approvedByName: nameOf(users, t.approvedBy), status: t.status as TxnStatus, remarks: `→ ${t.toHeadName ?? ""}`,
    });
    if (!headId || t.toHeadId === headId) entries.push({
      date: t.transferDate, type: "Transfer In", refNo: t.transferNo, headName: t.toHeadName ?? "",
      previousBudget: num(t.toPrevBudget), amount: num(t.amount), currentBudget: num(t.toNewBudget),
      createdByName: nameOf(users, t.requestedBy), approvedByName: nameOf(users, t.approvedBy), status: t.status as TxnStatus, remarks: `← ${t.fromHeadName ?? ""}`,
    });
  }
  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return entries;
}
