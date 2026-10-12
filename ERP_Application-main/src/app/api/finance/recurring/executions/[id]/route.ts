import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { resolveUsers, nameOf } from "@/lib/finance/budgetTxn";
import { settlementFrom, parseLines } from "@/lib/finance/recurring";
import type { ExecutionDetail, PostingLine } from "@/lib/contracts/recurring";

const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/finance/recurring/executions/:id — full detail of a generated voucher:
// transaction, voucher, account posting (journal), party, and payment/collection status.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "finance.recurring");
  if (denied) return denied;

  const ex = await prisma.recurringExecution.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId }, include: { config: true } });
  if (!ex) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  const cfg = ex.config;

  let posting: PostingLine[] = [];
  let lines: ExecutionDetail["lines"] = [];
  let payable: { totalAmount: unknown; paidAmount: unknown; balanceAmount: unknown } | null = null;

  if (ex.voucherType === "PETTY_CASH" && ex.voucherId) {
    const pcv = await prisma.pettyCashVoucher.findFirst({ where: { id: ex.voucherId, tenantId: user.tenantId }, include: { lines: true } });
    if (pcv) lines = pcv.lines.map((l) => ({ headName: l.headName, description: l.description, taxable: num(l.taxable ?? l.amount), gst: num(l.taxAmount), amount: num(l.amount) }));
    const je = await prisma.journalEntry.findFirst({ where: { tenantId: user.tenantId, sourceType: "PETTY_CASH", sourceId: ex.voucherId }, include: { lines: { include: { account: true } } } });
    posting = (je?.lines ?? []).map((l) => ({ code: l.account.code, name: l.account.name, debit: num(l.debit), credit: num(l.credit), narration: l.narration }));
    if (cfg.postingMethod !== "pay_now") payable = await prisma.payable.findFirst({ where: { tenantId: user.tenantId, sourceType: "EXPENSE", sourceId: ex.voucherId }, select: { totalAmount: true, paidAmount: true, balanceAmount: true } });
  } else if (ex.voucherType === "RECEIPT" && ex.voucherId) {
    const je = await prisma.journalEntry.findFirst({ where: { id: ex.voucherId, tenantId: user.tenantId }, include: { lines: { include: { account: true } } } });
    posting = (je?.lines ?? []).map((l) => ({ code: l.account.code, name: l.account.name, debit: num(l.debit), credit: num(l.credit), narration: l.narration }));
    lines = parseLines(cfg).map((l) => ({ headName: l.headName, description: l.description, taxable: num(l.amount), gst: cfg.gstApplicable ? num(l.amount) * num(l.gstPct) / 100 : 0, amount: num(l.amount) + (cfg.gstApplicable ? num(l.amount) * num(l.gstPct) / 100 : 0) }));
  }

  const users = await resolveUsers(prisma, [ex.generatedByUserId]);
  const detail: ExecutionDetail = {
    execution: { executionNo: ex.executionNo, executionDate: ex.executionDate, dueDate: ex.dueDate, amount: num(ex.amount), status: ex.status as ExecutionDetail["execution"]["status"], voucherType: ex.voucherType, voucherNo: ex.voucherNo, generatedBy: ex.generatedBy, generatedByName: nameOf(users, ex.generatedByUserId), remarks: ex.remarks },
    config: { configNo: cfg.configNo, name: cfg.name, txnType: cfg.txnType as "expense" | "income", postingMethod: cfg.postingMethod, partyName: cfg.partyName, partyType: cfg.partyType, department: cfg.department, costCenter: cfg.costCenter, project: cfg.project, gstApplicable: cfg.gstApplicable },
    lines, posting,
    settlement: settlementFrom({ txnType: cfg.txnType, postingMethod: cfg.postingMethod, amount: num(ex.amount), status: ex.status, settledAmount: num(ex.settledAmount) }, payable),
  };
  return NextResponse.json({ ok: true, detail });
}
