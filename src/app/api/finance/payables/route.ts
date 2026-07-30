import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { groupByParty } from "@/lib/finance/aging";
import type { PayableRow, PayableStats } from "@/lib/contracts/finance";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const PERM = "finance.payables";

// GET /api/finance/payables — supplier payables (from GRNs etc.), tenant-scoped.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.PayableWhereInput = { ...sw };
  if (status !== "All") where.status = status;
  if (q) where.OR = [{ supplier: { contains: q } }, { refNo: { contains: q } }];

  const today = new Date().toISOString().slice(0, 10);
  const [rows, agg, open, openRows] = await Promise.all([
    prisma.payable.findMany({ where, orderBy: [{ dueDate: "asc" }, { id: "desc" }], take: 300 }),
    prisma.payable.aggregate({ where: sw, _sum: { balanceAmount: true, totalAmount: true, paidAmount: true } }),
    prisma.payable.count({ where: { ...sw, status: { not: "Paid" } } }),
    prisma.payable.findMany({ where: { ...sw, status: { not: "Paid" } }, select: { supplier: true, docDate: true, dueDate: true, totalAmount: true, paidAmount: true, balanceAmount: true } }),
  ]);

  const shaped: PayableRow[] = rows.map((p) => ({
    id: p.id, sourceType: p.sourceType, sourceId: p.sourceId, refNo: p.refNo ?? "", supplier: p.supplier ?? "",
    docDate: p.docDate ?? "", dueDate: p.dueDate ?? "", paymentTerms: p.paymentTerms ?? "",
    totalAmount: num(p.totalAmount), paidAmount: num(p.paidAmount), balanceAmount: num(p.balanceAmount),
    status: p.status, overdue: !!(p.dueDate && p.dueDate < today && p.status !== "Paid"),
  }));

  // Supplier-grouped view + aging, from all open payables (independent of the filter).
  const { groups, aging } = groupByParty(openRows.map((p) => ({ party: p.supplier ?? "—", billed: num(p.totalAmount), paid: num(p.paidAmount), balance: num(p.balanceAmount), dueDate: p.dueDate ?? null, overdue: !!(p.dueDate && p.dueDate < today) })), today);
  const overdueAmt = +openRows.reduce((a, p) => a + (p.dueDate && p.dueDate < today ? num(p.balanceAmount) : 0), 0).toFixed(2);

  const stats: PayableStats = {
    open, outstanding: num(agg._sum.balanceAmount), billed: num(agg._sum.totalAmount), paid: num(agg._sum.paidAmount), overdue: overdueAmt, aging,
  };
  return NextResponse.json({ ok: true, rows: shaped, groups, stats });
}
