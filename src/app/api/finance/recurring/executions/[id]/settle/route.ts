import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { postSupplierPaymentJournal, postReceiptJournal } from "@/lib/accounting/post";

const PERM = "finance.recurring";
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);

// POST /api/finance/recurring/executions/:id/settle — pay (expense) or collect
// (income) against a generated voucher, full or partial. Posts the GL entry and
// updates the Payable (expense-AP) or the execution's collected amount (income).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "RecurringExecution" });
  if (denied) return denied;

  let b: { amount?: number; mode?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const ex = await prisma.recurringExecution.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId }, include: { config: true } });
  if (!ex) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  if (ex.status !== "Posted") return NextResponse.json({ ok: false, message: "Only posted vouchers can be settled." }, { status: 422 });
  const cfg = ex.config;
  const mode = String(b.mode || "Cash");
  const amount = r2(num(b.amount));
  if (amount <= 0) return NextResponse.json({ ok: false, message: "Enter an amount." }, { status: 422 });
  const seg = { businessId: cfg.businessId ?? undefined, branchId: cfg.branchId ?? undefined };
  const today = new Date().toISOString().slice(0, 10);

  try {
    if (cfg.txnType === "expense") {
      if (cfg.postingMethod === "pay_now") return NextResponse.json({ ok: false, message: "This voucher was already paid at generation." }, { status: 422 });
      const payable = await prisma.payable.findFirst({ where: { tenantId: user.tenantId, sourceType: "EXPENSE", sourceId: ex.voucherId ?? -1 } });
      if (!payable) return NextResponse.json({ ok: false, message: "No open payable for this voucher." }, { status: 422 });
      const bal = num(payable.balanceAmount);
      if (amount > bal + 0.01) return NextResponse.json({ ok: false, message: `Amount exceeds the outstanding balance (${bal.toFixed(2)}).` }, { status: 422 });

      await prisma.$transaction(async (tx) => {
        await postSupplierPaymentJournal(tx, { tenantId: user.tenantId, ...seg, date: today, paymentNo: `${ex.executionNo}-PAY`, supplier: cfg.partyName, amount, mode, createdBy: user.id });
        const paid = r2(num(payable.paidAmount) + amount);
        const newBal = r2(num(payable.totalAmount) - paid);
        await tx.payable.update({ where: { id: payable.id }, data: { paidAmount: paid, balanceAmount: newBal, status: newBal <= 0.01 ? "Paid" : "Partial" } });
        await tx.recurringExecution.update({ where: { id: ex.id }, data: { settledAmount: r2(num(ex.settledAmount) + amount) } });
      });
      await writeAudit(prisma, user, { action: "recurring.pay", entity: "RecurringExecution", entityId: ex.id, summary: `Paid ${amount.toFixed(2)} against ${ex.voucherNo} (${cfg.configNo})`, meta: { voucherNo: ex.voucherNo, amount, mode }, businessId: cfg.businessId ?? null, branchId: cfg.branchId ?? null, ip: requestMeta(req).ip });
      return NextResponse.json({ ok: true, message: `Payment of ${amount.toFixed(2)} posted.` });
    }

    // Income collection
    if (cfg.postingMethod === "receive_now") return NextResponse.json({ ok: false, message: "This receipt was already collected at generation." }, { status: 422 });
    const bal = r2(num(ex.amount) - num(ex.settledAmount));
    if (amount > bal + 0.01) return NextResponse.json({ ok: false, message: `Amount exceeds the outstanding balance (${bal.toFixed(2)}).` }, { status: 422 });

    await prisma.$transaction(async (tx) => {
      await postReceiptJournal(tx, { tenantId: user.tenantId, ...seg, date: today, refNo: `${ex.executionNo}-COL`, customerName: cfg.partyName, amount, mode, createdBy: user.id });
      await tx.recurringExecution.update({ where: { id: ex.id }, data: { settledAmount: r2(num(ex.settledAmount) + amount) } });
    });
    await writeAudit(prisma, user, { action: "recurring.collect", entity: "RecurringExecution", entityId: ex.id, summary: `Collected ${amount.toFixed(2)} against ${ex.voucherNo} (${cfg.configNo})`, meta: { voucherNo: ex.voucherNo, amount, mode }, businessId: cfg.businessId ?? null, branchId: cfg.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: `Collection of ${amount.toFixed(2)} posted.` });
  } catch (err) {
    console.error("[recurring] settle error", err);
    return NextResponse.json({ ok: false, message: "Could not post the settlement." }, { status: 500 });
  }
}
