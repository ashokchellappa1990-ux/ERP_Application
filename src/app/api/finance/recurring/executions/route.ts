import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { resolveUsers, nameOf } from "@/lib/finance/budgetTxn";
import { settlementFrom } from "@/lib/finance/recurring";
import type { ExecutionRow } from "@/lib/contracts/recurring";

// GET /api/finance/recurring/executions — execution history + payment/collection status.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "finance.recurring");
  if (denied) return denied;
  const scope = await getActiveScope(user);
  const rows = await prisma.recurringExecution.findMany({
    where: { tenantId: user.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) },
    include: { config: { select: { configNo: true, name: true, txnType: true, postingMethod: true } } }, orderBy: { id: "desc" }, take: 300,
  });
  const users = await resolveUsers(prisma, rows.map((r) => r.generatedByUserId));
  // Batch-load payables for expense-AP executions to derive Fully Paid / Partial / Unpaid.
  const apVoucherIds = rows.filter((r) => r.config.txnType === "expense" && r.config.postingMethod !== "pay_now" && r.voucherType === "PETTY_CASH" && r.voucherId).map((r) => r.voucherId!);
  const pays = apVoucherIds.length ? await prisma.payable.findMany({ where: { tenantId: user.tenantId, sourceType: "EXPENSE", sourceId: { in: apVoucherIds } }, select: { sourceId: true, totalAmount: true, paidAmount: true, balanceAmount: true } }) : [];
  const payByVoucher = new Map(pays.map((p) => [p.sourceId, p]));

  const list: ExecutionRow[] = rows.map((r) => ({
    id: r.id, executionNo: r.executionNo, configNo: r.config.configNo, configName: r.config.name, txnType: r.config.txnType as "expense" | "income",
    executionDate: r.executionDate, dueDate: r.dueDate, amount: Number(r.amount) || 0, status: r.status as ExecutionRow["status"],
    voucherType: r.voucherType, voucherNo: r.voucherNo, generatedBy: r.generatedBy, generatedByName: nameOf(users, r.generatedByUserId), remarks: r.remarks,
    settlement: settlementFrom({ txnType: r.config.txnType, postingMethod: r.config.postingMethod, amount: Number(r.amount) || 0, status: r.status, settledAmount: Number(r.settledAmount) || 0 }, r.voucherId ? payByVoucher.get(r.voucherId) : null),
  }));
  return NextResponse.json({ ok: true, rows: list });
}
